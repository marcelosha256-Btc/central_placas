export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    if (!customerId) {
      return NextResponse.json({ error: 'Selecione um cliente' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom + 'T00:00:00-03:00');
    if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59-03:00');

    const whereOrders: any = { customerId };
    if (dateFrom || dateTo) whereOrders.createdAt = dateFilter;

    const orders = await prisma.order.findMany({
      where: { ...whereOrders, deleted: false },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const placas = orders.flatMap((o: any) =>
      (o.items ?? []).map((it: any) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt,
        plateNumber: it.plateNumber || '-',
        product: it.product?.description || it.description || '',
        unitPrice: it.unitPrice ?? 0,
        totalPrice: it.totalPrice ?? 0,
        orderTotal: o.totalAmount ?? 0,
        orderPaid: o.paidAmount ?? 0,
        orderBalance: Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)),
        status: (o.totalAmount ?? 0) - (o.paidAmount ?? 0) <= 0 ? 'Pago' : (o.paidAmount ?? 0) > 0 ? 'Parcial' : 'Em aberto',
        paymentMethod: o.paymentMethod || '-',
      }))
    );

    const totalGeral = orders.reduce((acc: number, o: any) => acc + (o.totalAmount ?? 0), 0);
    const totalPago = orders.reduce((acc: number, o: any) => acc + (o.paidAmount ?? 0), 0);
    const totalAberto = Math.max(0, totalGeral - totalPago);

    const ordersData = orders.map((o: any) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount ?? 0,
      paidAmount: o.paidAmount ?? 0,
      remaining: Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)),
      status: (o.totalAmount ?? 0) - (o.paidAmount ?? 0) <= 0 ? 'Pago' : (o.paidAmount ?? 0) > 0 ? 'Parcial' : 'Em aberto',
      items: (o.items ?? []).map((it: any) => ({
        plateNumber: it.plateNumber || '-',
        product: it.product?.description || it.description || '',
        unitPrice: it.unitPrice ?? 0,
        quantity: it.quantity ?? 1,
      })),
      payments: (o.payments ?? []).map((p: any) => ({
        amount: p.amount ?? 0,
        paymentMethod: p.paymentMethod || '-',
        createdAt: p.createdAt,
      })),
    }));

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name, document: customer.document, whatsapp: customer.whatsapp },
      placas,
      orders: ordersData,
      summary: {
        totalPedidos: orders.length,
        totalPlacas: placas.length,
        totalGeral,
        totalPago,
        totalAberto,
      },
    });
  } catch (error) {
    console.error('[RELATORIO-CLIENTES] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}
