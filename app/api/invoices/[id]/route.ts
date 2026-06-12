export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - detalhe de uma fatura com pedidos e pagamentos
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true, whatsapp: true, document: true, paymentTerm: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    // Buscar pedidos vinculados com itens e pagamentos
    const orders = await prisma.order.findMany({
      where: { invoiceId: invoice.id },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Formatar pedidos para o frontend
    const formattedOrders = orders.map((o: any) => {
      const remaining = Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0));
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount ?? 0,
        paidAmount: o.paidAmount ?? 0,
        remaining,
        items: (o.items ?? []).map((it: any) => ({
          plateNumber: it.plateNumber || '-',
          product: it.product?.description || it.description || '',
          quantity: it.quantity ?? 1,
          unitPrice: it.unitPrice ?? 0,
        })),
        payments: (o.payments ?? []).map((p: any) => ({
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          createdAt: p.createdAt,
        })),
      };
    });

    // Calcular amountReceived real
    const amountReceived = orders.reduce((sum: number, o: any) => {
      return sum + (o.payments ?? []).reduce((ps: number, p: any) => ps + (p.amount ?? 0), 0);
    }, 0);

    // Derivar status
    const now = new Date();
    let derivedStatus = invoice.status;
    if (invoice.status !== 'CANCELADA' && invoice.status !== 'PAGA') {
      if (amountReceived >= invoice.amountDue && invoice.amountDue > 0) {
        derivedStatus = 'PAGA';
      } else if (amountReceived > 0 && amountReceived < invoice.amountDue) {
        derivedStatus = 'PARCIAL';
      } else if (invoice.dueDate && new Date(invoice.dueDate) < now && amountReceived < invoice.amountDue) {
        derivedStatus = 'VENCIDA';
      }
    }

    return NextResponse.json({
      ...invoice,
      amountReceived,
      derivedStatus,
      orders: formattedOrders,
    });
  } catch (error: any) {
    console.error('[INVOICES/ID] GET error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao buscar fatura' }, { status: 500 });
  }
}
