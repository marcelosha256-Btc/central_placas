export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeInvoiceReceived } from '@/lib/invoice-calc';

// GET - listar faturas com filtros
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const month = parseInt(url.searchParams.get('month') || '0');
    const year = parseInt(url.searchParams.get('year') || '0');
    const status = url.searchParams.get('status') || '';
    const customerId = url.searchParams.get('customerId') || '';

    const where: any = {};

    if (month && year) {
      const periodStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`);
      where.periodStart = periodStart;
    }

    if (status && status !== 'TODAS') {
      if (status === 'VENCIDA') {
        // VENCIDA é derivada: status não é PAGA/CANCELADA e dueDate < hoje
        where.status = { notIn: ['PAGA', 'CANCELADA'] };
        where.dueDate = { lt: new Date() };
      } else {
        where.status = status;
      }
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, whatsapp: true, document: true, paymentTerm: true, reportType: true } },
      },
      orderBy: [{ customer: { name: 'asc' } }],
    });

    // Recalcular amountReceived em tempo real (a partir do saldo dos pedidos) e derivar VENCIDA
    const now = new Date();
    const enriched = await Promise.all(
      invoices.map(async (inv: any) => {
        const { amountReceived, openBalance } = await computeInvoiceReceived(inv);

        // Derivar status em tempo real
        let derivedStatus = inv.status;
        if (inv.status !== 'CANCELADA' && inv.status !== 'PAGA') {
          if (openBalance <= 0.01 && (inv.amountDue ?? 0) > 0) {
            derivedStatus = 'PAGA';
          } else if (amountReceived > 0.01) {
            derivedStatus = 'PARCIAL';
          } else if (inv.dueDate && new Date(inv.dueDate) < now) {
            derivedStatus = 'VENCIDA';
          }
        }

        return {
          ...inv,
          amountReceived,
          derivedStatus,
        };
      })
    );

    // Se filtro é VENCIDA, filtrar pelo derivedStatus
    let filtered = enriched;
    if (status === 'VENCIDA') {
      filtered = enriched.filter((inv: any) => inv.derivedStatus === 'VENCIDA');
    }

    // Para os TOTAIS financeiros, evitar dupla contagem entre meses: o amountDue
    // de cada fatura já carrega o saldo anterior, então somar várias faturas do
    // mesmo cliente (ao ver mais de um mês) contaria o mesmo débito repetido.
    // Solução: considerar só a fatura mais recente de cada cliente. Com filtro de
    // mês (1 fatura por cliente) o resultado é idêntico ao de antes.
    let summaryBase = filtered;
    if (!(month && year)) {
      const latestByCustomer = new Map<string, any>();
      for (const inv of filtered) {
        const prev = latestByCustomer.get(inv.customerId);
        if (!prev || new Date(inv.periodStart) > new Date(prev.periodStart)) {
          latestByCustomer.set(inv.customerId, inv);
        }
      }
      summaryBase = Array.from(latestByCustomer.values());
    }

    // Sumário
    const summary = {
      total: filtered.length,
      totalServicos: summaryBase.reduce((a: number, i: any) => a + (i.servicesTotal ?? 0), 0),
      totalSaldoAnterior: summaryBase.reduce((a: number, i: any) => a + (i.previousBalance ?? 0), 0),
      totalDevido: summaryBase.reduce((a: number, i: any) => a + (i.amountDue ?? 0), 0),
      totalRecebido: summaryBase.reduce((a: number, i: any) => a + (i.amountReceived ?? 0), 0),
      totalAberto: summaryBase.reduce((a: number, i: any) => a + Math.max(0, (i.amountDue ?? 0) - (i.amountReceived ?? 0)), 0),
      porStatus: {
        GERADA: filtered.filter((i: any) => i.derivedStatus === 'GERADA').length,
        ENVIADA: filtered.filter((i: any) => i.derivedStatus === 'ENVIADA').length,
        PARCIAL: filtered.filter((i: any) => i.derivedStatus === 'PARCIAL').length,
        PAGA: filtered.filter((i: any) => i.derivedStatus === 'PAGA').length,
        VENCIDA: filtered.filter((i: any) => i.derivedStatus === 'VENCIDA').length,
        CANCELADA: filtered.filter((i: any) => i.derivedStatus === 'CANCELADA').length,
      },
    };

    return NextResponse.json({ data: filtered, summary });
  } catch (error: any) {
    console.error('[INVOICES] GET error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao buscar faturas' }, { status: 500 });
  }
}

// PUT - atualizar status da fatura (marcar enviada, cancelar, etc.)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, action, cancelReason } = body ?? {};

    if (!id || !action) {
      return NextResponse.json({ error: 'ID e ação são obrigatórios' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    // Baixa de pagamento (total ou parcial). Paga os pedidos cobrados pela
    // fatura, do mais antigo primeiro, criando os Payment e atualizando o
    // status dos pedidos. Data do pagamento = agora (quando o operador clica).
    if (action === 'registerPayment') {
      const amountToPay = Number(body.amount) || 0;
      const discount = Number(body.discount) || 0;
      const discountReason = (body.discountReason || '').trim();
      const method = (body.paymentMethod || 'PIX') as string;

      if (amountToPay <= 0 && discount <= 0) {
        return NextResponse.json({ error: 'Informe um valor maior que zero' }, { status: 400 });
      }
      if (discount > 0 && !discountReason) {
        return NextResponse.json({ error: 'Informe o motivo do desconto' }, { status: 400 });
      }
      if (invoice.status === 'CANCELADA') {
        return NextResponse.json({ error: 'Fatura cancelada' }, { status: 400 });
      }

      // Verificar limite de desconto do funcionário
      const userId = (session.user as any).id;
      const userName = (session.user as any).name || '';
      const userRole = (session.user as any).role || '';
      if (discount > 0 && userRole !== 'admin') {
        const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { discountLimit: true } });
        const limit = currentUser?.discountLimit ?? 0;
        if (discount > limit) {
          return NextResponse.json({
            error: `Desconto de R$ ${discount.toFixed(2)} acima do seu limite (R$ ${limit.toFixed(2)}). Peça autorização do administrador.`
          }, { status: 403 });
        }
      }

      // Exige caixa aberto (entrada só do valor recebido, não do desconto)
      const openCash = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (!openCash) {
        return NextResponse.json({ error: 'Caixa fechado. Abra o caixa antes de registrar o pagamento da fatura.' }, { status: 400 });
      }
      const customer = await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { name: true } });
      const customerName = customer?.name || '';

      const orders = await prisma.order.findMany({
        where: { customerId: invoice.customerId, deleted: false, createdAt: { lte: invoice.periodEnd } },
        orderBy: { createdAt: 'asc' },
      });
      const openOrders = orders.filter((o: any) => (o.totalAmount ?? 0) - (o.paidAmount ?? 0) > 0.01);
      const totalOpen = openOrders.reduce((s: number, o: any) => s + ((o.totalAmount ?? 0) - (o.paidAmount ?? 0)), 0);

      // (recebido + desconto) não pode passar do saldo em aberto
      if ((amountToPay + discount) - totalOpen > 0.01) {
        return NextResponse.json({ error: `Recebido + desconto (R$ ${(amountToPay + discount).toFixed(2)}) maior que o saldo em aberto (R$ ${totalOpen.toFixed(2)})` }, { status: 400 });
      }

      // Quitar pedidos: o "total a quitar" = recebido + desconto
      const totalToSettle = amountToPay + discount;
      let remaining = totalToSettle;
      let cashRemaining = amountToPay; // só o dinheiro real entra no caixa
      for (const o of openOrders) {
        if (remaining <= 0.001) break;
        const orderOpen = (o.totalAmount ?? 0) - (o.paidAmount ?? 0);
        const settle = Math.min(remaining, orderOpen);
        const cashPart = Math.min(cashRemaining, settle); // quanto desse pedido é dinheiro real
        remaining -= settle;
        cashRemaining -= cashPart;

        // Payment no pedido = só o valor real recebido (sem desconto)
        if (cashPart > 0.001) {
          await prisma.payment.create({
            data: { orderId: o.id, amount: cashPart, paymentMethod: method, notes: `Baixa fatura ${invoice.number}` },
          });
        }

        // Atualizar paidAmount com o total quitado (recebido + desconto pro-rata)
        const newPaid = (o.paidAmount ?? 0) + settle;
        await prisma.order.update({
          where: { id: o.id },
          data: { paidAmount: newPaid, ...(newPaid >= (o.totalAmount ?? 0) - 0.01 ? { status: 'PAGO' } : {}) },
        });
        if (userId) {
          const auditReason = discount > 0
            ? `Fatura ${invoice.number} - ${method} (desconto R$ ${discount.toFixed(2)})`
            : `Fatura ${invoice.number} - ${method}`;
          await prisma.orderAudit.create({
            data: { orderId: o.id, userId, userName, action: 'RECEBIMENTO', reason: auditReason },
          });
        }
        // Entrada no caixa = só o dinheiro real
        if (cashPart > 0.001) {
          await prisma.cashMovement.create({
            data: {
              cashRegisterId: openCash.id,
              type: 'ENTRADA',
              amount: cashPart,
              description: `Fatura ${invoice.number} - Pedido #${o.orderNumber} - ${customerName}`,
              paymentMethod: method,
              orderId: o.id,
            },
          });
        }
      }

      // Registrar desconto para auditoria
      if (discount > 0.001) {
        await prisma.invoiceDiscount.create({
          data: {
            invoiceId: invoice.id,
            userId,
            userName,
            customerId: invoice.customerId,
            customerName,
            invoiceNumber: invoice.number,
            amount: discount,
            reason: discountReason,
          },
        });
      }

      const { amountReceived, openBalance } = await computeInvoiceReceived(invoice);
      let newStatus = invoice.status;
      if (openBalance <= 0.01 && (invoice.amountDue ?? 0) > 0) newStatus = 'PAGA';
      else if (amountReceived > 0.01) newStatus = 'PARCIAL';

      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          amountReceived,
          status: newStatus,
          ...(newStatus === 'PAGA' ? { paidAt: new Date(), confirmedAt: new Date() } : {}),
        },
      });
      return NextResponse.json({ success: true, invoice: updated, amountReceived, openBalance });
    }

    let updateData: any = {};

    switch (action) {
      case 'markSent':
        updateData = { status: 'ENVIADA', sentAt: new Date() };
        break;
      case 'markPaid': {
        const { openBalance } = await computeInvoiceReceived(invoice);
        if (openBalance > 0.01) {
          return NextResponse.json({
            error: `Existem pedidos em aberto (R$ ${openBalance.toFixed(2).replace('.', ',')}). Use o botão de baixa de pagamento.`
          }, { status: 400 });
        }
        updateData = { status: 'PAGA', paidAt: new Date(), confirmedAt: new Date() };
        break;
      }
      case 'cancel':
        updateData = { status: 'CANCELADA', cancelReason: cancelReason || '' };
        // Desvincular pedidos
        await prisma.order.updateMany({
          where: { invoiceId: id },
          data: { invoiceId: null },
        });
        break;
      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: any) {
    console.error('[INVOICES] PUT error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao atualizar fatura' }, { status: 500 });
  }
}
