export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - buscar dados agrupados por cliente
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const situacao = url.searchParams.get('situacao') || 'aberto';
    const modo = url.searchParams.get('modo') || 'abertos';
    const clienteId = url.searchParams.get('clienteId') || '';

    // Buscar clientes
    let customers: any[] = [];
    if (modo === 'selecionado' && clienteId) {
      customers = await prisma.customer.findMany({ where: { id: clienteId } });
    } else if (modo === 'mensal') {
      customers = await prisma.customer.findMany({ where: { monthlyReport: true } });
    } else {
      customers = await prisma.customer.findMany();
    }

    // Filtro de datas
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom + 'T00:00:00-03:00');
    if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59-03:00');

    // Buscar pedidos com filtros
    const whereOrders: any = {
      status: { in: ['ABERTO', 'PAGO'] },
    };
    if (dateFrom || dateTo) whereOrders.createdAt = dateFilter;

    const orders = await prisma.order.findMany({
      where: { ...whereOrders, deleted: false },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupar por cliente
    const result = customers.map((c: any) => {
      const clientOrders = orders.filter((o: any) => {
        if (o.customerId !== c.id) return false;
        // Filtro de situação
        const balance = (o.totalAmount ?? 0) - (o.paidAmount ?? 0);
        if (situacao === 'aberto') return balance > 0;
        if (situacao === 'pago') return balance <= 0;
        return true; // 'todos'
      });

      const placas = clientOrders.flatMap((o: any) =>
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
        }))
      );

      const totalAberto = clientOrders.reduce((acc: number, o: any) => {
        return acc + Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0));
      }, 0);

      return {
        customer: { id: c.id, name: c.name, whatsapp: c.whatsapp || '', document: c.document, monthlyReport: c.monthlyReport },
        pedidos: clientOrders.length,
        placas,
        totalAberto,
      };
    });

    // Filtrar resultado conforme modo
    let filtered = result;
    if (modo === 'abertos') filtered = result.filter((r: any) => r.totalAberto > 0);
    else if (modo === 'periodo') filtered = result.filter((r: any) => r.placas.length > 0);
    else if (modo === 'mensal') filtered = result.filter((r: any) => r.placas.length > 0 || r.totalAberto > 0);

    // Resumo
    const summary = {
      totalClientes: filtered.length,
      totalPlacas: filtered.reduce((a: number, r: any) => a + r.placas.length, 0),
      totalAberto: filtered.reduce((a: number, r: any) => a + r.totalAberto, 0),
      totalEnviados: 0,
    };

    return NextResponse.json({ data: filtered, summary });
  } catch (error) {
    console.error('[ENVIO-MENSAL] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}

// POST - marcar envio
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, customerId, periodStart, periodEnd, totalAmount, plateCount, sentVia } = body ?? {};

    if (action === 'markSent') {
      if (!customerId || !periodStart || !periodEnd) {
        return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
      }
      const send = await prisma.monthlySend.create({
        data: {
          customerId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          totalAmount: totalAmount ?? 0,
          plateCount: plateCount ?? 0,
          sentVia: sentVia ?? 'WHATSAPP',
        },
      });
      return NextResponse.json({ success: true, send });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[ENVIO-MENSAL] POST error:', error);
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
  }
}
