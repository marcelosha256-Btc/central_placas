export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeInvoiceReceived } from '@/lib/invoice-calc';

// POST - gerar/recalcular faturas de um mês
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { month, year } = body ?? {}; // month: 1-12, year: 2025

    if (!month || !year) {
      return NextResponse.json({ error: 'Mês e ano são obrigatórios' }, { status: 400 });
    }

    const periodStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const periodEnd = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00-03:00`);
    // periodEnd is exclusive (first day of next month)

    // Buscar clientes frota (monthlyReport = true)
    const customers = await prisma.customer.findMany({
      where: { monthlyReport: true },
    });

    const results: any[] = [];

    for (const customer of customers) {
      // Buscar pedidos do período SEM fatura (ou já vinculados a fatura deste período)
      const existingInvoice = await prisma.invoice.findUnique({
        where: {
          customerId_periodStart: {
            customerId: customer.id,
            periodStart,
          },
        },
      });

      // Pedidos do período que não estão em outra fatura
      const periodOrders = await prisma.order.findMany({
        where: {
          customerId: customer.id,
          deleted: false,
          createdAt: { gte: periodStart, lt: periodEnd },
          OR: [
            { invoiceId: null },
            ...(existingInvoice ? [{ invoiceId: existingInvoice.id }] : []),
          ],
        },
        include: {
          items: true,
          payments: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (periodOrders.length === 0 && !existingInvoice) {
        continue; // Sem pedidos e sem fatura existente - pular
      }

      // Calcular servicesTotal
      const servicesTotal = periodOrders.reduce((sum: number, o: any) => sum + (o.totalAmount ?? 0), 0);

      // Contar placas
      const plateCount = periodOrders.reduce((sum: number, o: any) => sum + (o.items?.length ?? 0), 0);

      // Saldo anterior = "em aberto" da última fatura anterior do cliente (encadeamento).
      // Assim o mesmo pedido não é recontado mês a mês: cada fatura carrega
      // apenas o saldo da fatura imediatamente anterior. Na PRIMEIRA fatura
      // (sem anterior), considera os pedidos em aberto antes do período.
      const prevInvoice = await prisma.invoice.findFirst({
        where: {
          customerId: customer.id,
          status: { not: 'CANCELADA' },
          periodStart: { lt: periodStart },
        },
        orderBy: { periodStart: 'desc' },
      });

      let previousBalance = 0;
      let previousInvoiceId: string | null = null;
      if (prevInvoice) {
        previousInvoiceId = prevInvoice.id;
        const { openBalance } = await computeInvoiceReceived(prevInvoice);
        previousBalance = openBalance;
      } else {
        const previousOpenOrders = await prisma.order.findMany({
          where: {
            customerId: customer.id,
            deleted: false,
            status: 'ABERTO',
            createdAt: { lt: periodStart },
          },
        });
        previousBalance = previousOpenOrders.reduce(
          (sum: number, o: any) => sum + Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)),
          0
        );
      }

      // amountReceived = soma de pagamentos dos pedidos vinculados
      const amountReceived = periodOrders.reduce((sum: number, o: any) => {
        return sum + (o.payments ?? []).reduce((ps: number, p: any) => ps + (p.amount ?? 0), 0);
      }, 0);

      const amountDue = servicesTotal + previousBalance;

      // Calcular vencimento baseado no paymentTerm do cliente.
      // A emissão acontece no 1º dia do mês seguinte (= variável periodEnd),
      // que é quando a fatura é gerada e enviada ao cliente.
      let dueDate: Date;
      const lastDayOfMonth = new Date(periodEnd.getTime() - 1); // último dia do mês de referência (campo periodEnd da fatura)
      const paymentTerm = (customer as any).paymentTerm || 'AVISTA';
      if (paymentTerm === 'D15') {
        dueDate = new Date(periodEnd.getTime() + 14 * 24 * 60 * 60 * 1000); // ~dia 15 do mês seguinte
      } else if (paymentTerm === 'D30') {
        dueDate = new Date(periodEnd.getTime() + 29 * 24 * 60 * 60 * 1000); // ~dia 30 do mês seguinte
      } else {
        dueDate = periodEnd; // À vista = vence na emissão (1º dia do mês seguinte), não no passado
      }

      // Determinar status
      let status = 'GERADA';
      if (amountReceived >= amountDue && amountDue > 0) {
        status = 'PAGA';
      } else if (amountReceived > 0 && amountReceived < amountDue) {
        status = 'PARCIAL';
      }

      // Gerar número da fatura
      const invoiceNumber = await generateInvoiceNumber(year, month, customer.id, existingInvoice?.number);

      if (existingInvoice) {
        // Atualizar fatura existente
        const updated = await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            previousBalance,
            previousInvoiceId,
            servicesTotal,
            amountDue,
            amountReceived,
            dueDate,
            status: existingInvoice.status === 'CANCELADA' ? 'CANCELADA' : status,
            orderCount: periodOrders.length,
            plateCount,
          },
        });

        // Vincular pedidos
        await prisma.order.updateMany({
          where: { id: { in: periodOrders.map((o: any) => o.id) } },
          data: { invoiceId: existingInvoice.id },
        });

        results.push({ action: 'updated', invoice: updated, customer: customer.name });
      } else {
        // Criar nova fatura
        const created = await prisma.invoice.create({
          data: {
            number: invoiceNumber,
            customerId: customer.id,
            periodStart,
            periodEnd: new Date(lastDayOfMonth.getTime()),
            previousBalance,
            previousInvoiceId,
            servicesTotal,
            amountDue,
            amountReceived,
            dueDate,
            status,
            orderCount: periodOrders.length,
            plateCount,
            createdById: (session.user as any).id,
          },
        });

        // Vincular pedidos
        if (periodOrders.length > 0) {
          await prisma.order.updateMany({
            where: { id: { in: periodOrders.map((o: any) => o.id) } },
            data: { invoiceId: created.id },
          });
        }

        results.push({ action: 'created', invoice: created, customer: customer.name });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} fatura(s) processada(s) para ${String(month).padStart(2, '0')}/${year}`,
      results,
    });
  } catch (error: any) {
    console.error('[INVOICES/GENERATE] POST error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao gerar faturas' }, { status: 500 });
  }
}

async function generateInvoiceNumber(year: number, month: number, customerId: string, existingNumber?: string | null): Promise<string> {
  if (existingNumber) return existingNumber; // Keep existing number on recalc

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  // Count existing invoices for this month
  const count = await prisma.invoice.count({
    where: {
      number: { startsWith: prefix },
    },
  });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}
