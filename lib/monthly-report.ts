// ============================================
// monthly-report — Cálculo do relatório mensal por cliente (no servidor).
// Fonte da verdade única: tanto a tela quanto a geração de PDF/XLS usam isto,
// para os números nunca divergirem e permitir geração automática (dia 01).
// ============================================
import { prisma } from '@/lib/prisma';

export interface MonthlyReportOptions {
  dateFrom?: string;       // 'YYYY-MM-DD'
  dateTo?: string;         // 'YYYY-MM-DD'
  situacao?: string;       // 'aberto' | 'pago' | 'todos'
  apenasEnvioMensal?: boolean;
  clienteId?: string;
}

export async function getMonthlyReportData(opts: MonthlyReportOptions) {
  const dateFrom = opts.dateFrom || '';
  const dateTo = opts.dateTo || '';
  const situacao = opts.situacao || 'aberto';
  const apenasEnvioMensal = !!opts.apenasEnvioMensal;
  const clienteId = opts.clienteId || '';

  // Clientes
  const customerWhere: any = {};
  if (clienteId) customerWhere.id = clienteId;
  if (apenasEnvioMensal) customerWhere.monthlyReport = true;
  const customers = await prisma.customer.findMany({ where: customerWhere });

  // Pedidos do período
  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom + 'T00:00:00-03:00');
  if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59-03:00');

  const whereOrders: any = { status: { in: ['ABERTO', 'PAGO'] } };
  if (dateFrom || dateTo) whereOrders.createdAt = dateFilter;

  const orders = await prisma.order.findMany({
    where: { ...whereOrders, deleted: false },
    include: { items: { include: { product: true } }, payments: true },
    orderBy: { createdAt: 'asc' },
  });

  // Pedidos ANTERIORES ao período com saldo em aberto (Saldo Anterior)
  let previousOrders: any[] = [];
  if (dateFrom) {
    previousOrders = await prisma.order.findMany({
      where: {
        status: 'ABERTO',
        deleted: false,
        createdAt: { lt: new Date(dateFrom + 'T00:00:00-03:00') },
      },
      include: { items: { include: { product: true } } },
    });
  }

  const result = customers.map((c: any) => {
    const clientOrders = orders.filter((o: any) => {
      if (o.customerId !== c.id) return false;
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

    const groupedOrders = clientOrders.map((o: any) => {
      const remaining = Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0));
      return {
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

    const totalAberto = clientOrders.reduce((acc: number, o: any) => acc + Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)), 0);
    const totalPago = clientOrders.reduce((acc: number, o: any) => acc + (o.paidAmount ?? 0), 0);
    const totalGeral = clientOrders.reduce((acc: number, o: any) => acc + (o.totalAmount ?? 0), 0);

    const clientPreviousOrders = previousOrders.filter((o: any) => o.customerId === c.id);
    const saldoAnterior = clientPreviousOrders.reduce((acc: number, o: any) => acc + Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)), 0);

    return {
      customer: { id: c.id, name: c.name, whatsapp: c.whatsapp || '', document: c.document, monthlyReport: c.monthlyReport, reportType: c.reportType },
      pedidos: clientOrders.length,
      placas,
      orders: groupedOrders,
      totalAberto,
      totalPago,
      totalGeralPedidos: totalGeral,
      saldoAnterior,
      totalGeral: totalAberto + saldoAnterior,
      summary: {
        totalPedidos: clientOrders.length,
        totalPlacas: placas.length,
        totalGeral,
        totalPago,
        totalAberto,
      },
    };
  });

  // Filtrar clientes sem resultado relevante
  let filtered = result;
  if (situacao === 'aberto') {
    filtered = result.filter((r: any) => r.totalAberto > 0 || r.saldoAnterior > 0);
  } else {
    filtered = result.filter((r: any) => r.placas.length > 0 || r.saldoAnterior > 0);
  }

  const summary = {
    totalClientes: filtered.length,
    totalPlacas: filtered.reduce((a: number, r: any) => a + r.placas.length, 0),
    totalAberto: filtered.reduce((a: number, r: any) => a + r.totalAberto, 0),
    totalSaldoAnterior: filtered.reduce((a: number, r: any) => a + r.saldoAnterior, 0),
    totalGeral: filtered.reduce((a: number, r: any) => a + r.totalGeral, 0),
    totalEnviados: 0,
  };

  return { data: filtered, summary };
}

// Formata 'YYYY-MM-DD' para 'DD/MM/AAAA' (pt-BR, fuso de São Paulo)
export function formatPeriodDate(d?: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
