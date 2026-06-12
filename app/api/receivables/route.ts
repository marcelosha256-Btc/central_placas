export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  // scope: balcao (padrão, exclui frota) | frota | todos.
  // Clientes frota (monthlyReport=true) são cobrados por fatura — sua conta a
  // receber é gerida em Faturamento. Por padrão não aparecem aqui para não
  // duplicar o débito e não misturar caminhos de recebimento.
  const scope = (searchParams.get('scope') ?? 'balcao').toLowerCase();

  const where: any = { status: 'ABERTO', deleted: false };
  if (customerId) where.customerId = customerId;
  if (scope === 'balcao') where.customer = { monthlyReport: false };
  else if (scope === 'frota') where.customer = { monthlyReport: true };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + 'T00:00:00-03:00');
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59-03:00');
  }

  const allOrders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, monthlyReport: true, document: true } },
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  const unpaid = allOrders.filter((o: any) => ((o.totalAmount ?? 0) - (o.paidAmount ?? 0)) > 0.01);

  // Agrupar por cliente
  const grouped: Record<string, any> = {};
  for (const o of unpaid) {
    const cid = o.customerId;
    if (!grouped[cid]) {
      grouped[cid] = {
        customerId: cid,
        customerName: o.customer?.name ?? '-',
        customerDocument: o.customer?.document ?? '',
        monthlyReport: o.customer?.monthlyReport ?? false,
        totalAmount: 0,
        paidAmount: 0,
        remaining: 0,
        orderCount: 0,
        orders: [],
      };
    }
    const remaining = Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0));
    grouped[cid].totalAmount += o.totalAmount ?? 0;
    grouped[cid].paidAmount += o.paidAmount ?? 0;
    grouped[cid].remaining += remaining;
    grouped[cid].orderCount += 1;
    grouped[cid].orders.push({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount ?? 0,
      paidAmount: o.paidAmount ?? 0,
      remaining,
      createdAt: o.createdAt,
      items: (o.items ?? []).map((it: any) => ({
        plateNumber: it.plateNumber || '-',
        product: it.product?.description || it.description || '',
        unitPrice: it.unitPrice ?? 0,
        quantity: it.quantity ?? 1,
      })),
      payments: (o.payments ?? []).map((p: any) => ({
        amount: p.amount ?? 0,
        paymentMethod: p.paymentMethod || '',
        createdAt: p.createdAt,
      })),
    });
  }

  const clients = Object.values(grouped).sort((a: any, b: any) => b.remaining - a.remaining);
  const totalRestante = clients.reduce((acc: number, c: any) => acc + c.remaining, 0);

  return NextResponse.json({
    clients,
    total: clients.length,
    totalRestante,
  });
}
