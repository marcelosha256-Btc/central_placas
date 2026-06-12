export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcBalance } from '@/lib/calc-balance';
import { computeInvoiceReceived } from '@/lib/invoice-calc';

// Classifica uma placa pelo texto do produto (PAR / MOTO / DIANTEIRA / TRASEIRA)
function plateType(description: string): 'pares' | 'motos' | 'dianteiras' | 'traseiras' | 'outros' {
  const d = (description || '').toUpperCase();
  if (d.includes('PAR')) return 'pares';
  if (d.includes('MOTO')) return 'motos';
  if (d.includes('DIANT')) return 'dianteiras';
  if (d.includes('TRAS')) return 'traseiras';
  return 'outros';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const isAdmin = (session.user as any)?.role === 'admin';

  try {
    // Usar horário de Brasília (UTC-3) para determinar "hoje"
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yyyy = nowBR.getFullYear();
    const mm = String(nowBR.getMonth() + 1).padStart(2, '0');
    const dd = String(nowBR.getDate()).padStart(2, '0');
    const today = new Date(`${yyyy}-${mm}-${dd}T00:00:00-03:00`);
    const tomorrow = new Date(`${yyyy}-${mm}-${dd}T23:59:59-03:00`);

    // ===== BLOCO 1 — Operação do dia =====

    // Vendas de hoje
    const salesToday = await prisma.order.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow }, deleted: false },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Placas de hoje por tipo (itens dos pedidos de hoje)
    const todayItems = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: today, lt: tomorrow }, deleted: false } },
      select: { description: true, quantity: true },
    });
    const platesToday = { pares: 0, motos: 0, dianteiras: 0, traseiras: 0, outros: 0, total: 0 };
    for (const it of todayItems) {
      const q = it.quantity ?? 1;
      platesToday[plateType(it.description)] += q;
      platesToday.total += q;
    }

    // Saldo do caixa aberto
    const openCash = await prisma.cashRegister.findFirst({
      where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      orderBy: { openDate: 'desc' },
      include: { movements: true },
    });
    let cashBalance = 0;
    if (openCash) cashBalance = calcBalance(openCash).balance;

    // ===== BLOCO 2 — Cobrança e pendências =====

    // Pedidos em aberto (balcão = clientes sem relatório mensal)
    const openBalcao = await prisma.order.findMany({
      where: { status: 'ABERTO', deleted: false, customer: { monthlyReport: false } },
      select: { totalAmount: true, paidAmount: true },
    });
    let pendingAmount = 0;
    for (const o of openBalcao) pendingAmount += Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0));
    const pendingOrders = openBalcao.length;

    // Inadimplência: faturas (frota) vencidas com saldo em aberto
    const overdueCandidates = await prisma.invoice.findMany({
      where: { dueDate: { lt: today }, status: { notIn: ['PAGA', 'CANCELADA'] } },
      select: { id: true, number: true, customerId: true, periodEnd: true, amountDue: true, dueDate: true, customer: { select: { name: true, whatsapp: true, phone: true } } },
      orderBy: { dueDate: 'asc' },
    });
    let overdueAmount = 0;
    const overdueList: { name: string; whatsapp: string; invoiceNumber: string; amount: number; dueDate: Date; daysLate: number }[] = [];
    for (const inv of overdueCandidates) {
      const { openBalance } = await computeInvoiceReceived(inv);
      if (openBalance > 0.01) {
        overdueAmount += openBalance;
        const daysLate = Math.max(1, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
        overdueList.push({
          name: inv.customer?.name ?? '-',
          whatsapp: inv.customer?.whatsapp || inv.customer?.phone || '',
          invoiceNumber: inv.number,
          amount: openBalance,
          dueDate: inv.dueDate,
          daysLate,
        });
      }
    }

    // Contas a pagar vencendo hoje ou atrasadas (pendentes)
    const payables = await prisma.expense.findMany({
      where: { status: 'PENDENTE', dueDate: { lte: tomorrow } },
      select: { amount: true },
    });
    const payablesAmount = payables.reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    const payablesCount = payables.length;

    // Placas produzidas no mês (soma das quantidades dos itens) — para a meta
    const monthStart = new Date(`${yyyy}-${mm}-01T00:00:00-03:00`);
    const monthItems = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: monthStart, lt: tomorrow }, deleted: false } },
      select: { quantity: true },
    });
    const platesMonth = monthItems.reduce((s: number, it: any) => s + (it.quantity ?? 1), 0);

    // Mix de receita do mês: balcão (paga na hora) vs frota (fatura mensal)
    const [mixBalcao, mixFrota] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart, lt: tomorrow }, deleted: false, customer: { monthlyReport: false } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart, lt: tomorrow }, deleted: false, customer: { monthlyReport: true } },
        _sum: { totalAmount: true },
      }),
    ]);

    // ===== BLOCO ESTOQUE — para todos os roles =====
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);

    const stockProds = await prisma.product.findMany({
      where: { trackStock: true },
      select: { id: true, code: true, description: true, stockQuantity: true, minStock: true, leadTimeDays: true },
      orderBy: { description: 'asc' },
    });

    const stockSnapshot = await Promise.all(stockProds.map(async (p: any) => {
      const [committedItems, consumedAgg] = await Promise.all([
        prisma.orderItem.findMany({
          where: { order: { deleted: false, status: 'ABERTO' }, product: { stockItemId: p.id } },
          select: { quantity: true, product: { select: { consumptionQty: true } } },
        }),
        prisma.stockMovement.aggregate({
          where: { productId: p.id, type: 'SAIDA', reversed: false, createdAt: { gte: since60 } },
          _sum: { quantity: true },
        }),
      ]);
      const committedQty = (committedItems as any[]).reduce((s: number, it: any) => s + it.quantity * (it.product.consumptionQty ?? 1), 0);
      const availableQty = (p.stockQuantity ?? 0) - committedQty;
      const consumed60 = (consumedAgg as any)._sum?.quantity ?? 0;
      const dailyAvg = consumed60 / 60;
      const lt = p.leadTimeDays ?? 7;
      const daysRemaining = dailyAvg > 0.01 ? Math.floor(availableQty / dailyAvg) : null;
      const overCommitted = availableQty < 0;
      const orderUrgent = !overCommitted && daysRemaining !== null && daysRemaining <= lt;
      const orderSoon = !overCommitted && daysRemaining !== null && daysRemaining <= lt + 7 && !orderUrgent;
      return {
        id: p.id, code: p.code, description: p.description,
        stockQuantity: p.stockQuantity ?? 0,
        availableQty: Math.round(availableQty),
        committedQty: Math.round(committedQty),
        minStock: p.minStock ?? 0,
        dailyAvg: Math.round(dailyAvg * 10) / 10,
        daysRemaining, leadTimeDays: lt,
        orderUrgent, orderSoon, overCommitted,
      };
    }));

    const alertItems = (stockSnapshot as any[]).filter((p: any) => p.overCommitted || p.orderUrgent || p.availableQty <= p.minStock);
    const lowStockCount = alertItems.length;
    const lowStockNames = alertItems.slice(0, 6).map((p: any) => p.description);

    // Admin: dados financeiros do estoque
    let stockValue = 0, stockSpentThisMonth = 0, avgEfficiency: number | null = null;
    if (isAdmin) {
      for (const p of stockProds as any[]) {
        const entries = await prisma.stockMovement.findMany({
          where: { productId: p.id, type: 'ENTRADA', unitCost: { not: null } },
          select: { quantity: true, unitCost: true },
        });
        const totalEntryQty = (entries as any[]).reduce((s: number, e: any) => s + e.quantity, 0);
        const totalEntryCost = (entries as any[]).reduce((s: number, e: any) => s + e.quantity * (e.unitCost ?? 0), 0);
        const avgCost = totalEntryQty > 0 ? totalEntryCost / totalEntryQty : 0;
        stockValue += (p.stockQuantity ?? 0) * avgCost;
      }
      const [monthEntradas, allSaidasAgg, allAvariasAgg] = await Promise.all([
        prisma.stockMovement.findMany({
          where: { type: 'ENTRADA', unitCost: { not: null }, createdAt: { gte: monthStart, lt: tomorrow }, product: { trackStock: true } },
          select: { quantity: true, unitCost: true },
        }),
        prisma.stockMovement.aggregate({
          where: { type: 'SAIDA', reversed: false, createdAt: { gte: since60 }, product: { trackStock: true } },
          _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
          where: { type: 'AVARIA', createdAt: { gte: since60 }, product: { trackStock: true } },
          _sum: { quantity: true },
        }),
      ]);
      stockSpentThisMonth = (monthEntradas as any[]).reduce((s: number, e: any) => s + e.quantity * (e.unitCost ?? 0), 0);
      const totalSaidas = (allSaidasAgg as any)._sum?.quantity ?? 0;
      const totalAvarias = (allAvariasAgg as any)._sum?.quantity ?? 0;
      const totalOut = totalSaidas + totalAvarias;
      avgEfficiency = totalOut > 0 ? Math.round((totalSaidas / totalOut) * 100) : null;
    }

    // ===== Gráfico 7 dias + últimos pedidos =====
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, deleted: false },
      select: { createdAt: true, totalAmount: true },
    });

    const salesByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      salesByDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const o of recentOrders ?? []) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (salesByDay[key] !== undefined) salesByDay[key] += o.totalAmount ?? 0;
    }
    const chartData = Object.entries(salesByDay).map(([date, total]) => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      total,
    }));

    const latestOrders = await prisma.order.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { name: true } } },
    });

    // ===== Admin: Visão Financeira (só calculado para role admin) =====
    let monthRevenue = 0, prevMonthRevenue = 0, avgTicket = 0, projectedRevenue = 0, monthExpenses = 0;
    let topClients: { name: string; revenue: number; orders: number }[] = [];

    if (isAdmin) {
      const prevMonthDate = new Date(nowBR.getFullYear(), nowBR.getMonth() - 1, 1);
      const prevYyyy = String(prevMonthDate.getFullYear());
      const prevMm = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const prevMonthStart = new Date(`${prevYyyy}-${prevMm}-01T00:00:00-03:00`);

      const [prevMonthAgg, monthCountAgg, monthExpensesAgg, topClientsRaw] = await Promise.all([
        prisma.order.aggregate({
          where: { createdAt: { gte: prevMonthStart, lt: monthStart }, deleted: false },
          _sum: { totalAmount: true },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: monthStart, lt: tomorrow }, deleted: false },
          _count: true,
        }),
        prisma.expense.aggregate({
          where: { createdAt: { gte: monthStart, lt: tomorrow } },
          _sum: { amount: true },
        }),
        prisma.order.groupBy({
          by: ['customerId'],
          where: { createdAt: { gte: monthStart, lt: tomorrow }, deleted: false },
          _sum: { totalAmount: true },
          _count: true,
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 5,
        }),
      ]);

      monthRevenue = (mixBalcao._sum?.totalAmount ?? 0) + (mixFrota._sum?.totalAmount ?? 0);
      prevMonthRevenue = prevMonthAgg._sum?.totalAmount ?? 0;
      const monthOrderCount = (monthCountAgg as any)._count ?? 0;
      avgTicket = monthOrderCount > 0 ? monthRevenue / monthOrderCount : 0;
      const dayOfMonth = nowBR.getDate();
      const daysInMonth = new Date(Number(yyyy), Number(mm), 0).getDate();
      projectedRevenue = dayOfMonth > 0 ? Math.round(monthRevenue / (dayOfMonth / daysInMonth)) : 0;
      monthExpenses = monthExpensesAgg._sum?.amount ?? 0;

      const topClientIds = (topClientsRaw as any[]).map((r: any) => r.customerId).filter(Boolean) as string[];
      const topCustomers = topClientIds.length
        ? await prisma.customer.findMany({ where: { id: { in: topClientIds } }, select: { id: true, name: true } })
        : [];
      const custMap: Record<string, string> = Object.fromEntries((topCustomers as any[]).map((c: any) => [c.id, c.name]));
      topClients = (topClientsRaw as any[]).map((r: any) => ({
        name: custMap[r.customerId ?? ''] ?? '-',
        revenue: r._sum?.totalAmount ?? 0,
        orders: r._count ?? 0,
      }));
    }

    return NextResponse.json({
      // Bloco 1
      salesTodayAmount: salesToday._sum?.totalAmount ?? 0,
      salesTodayCount: salesToday._count ?? 0,
      platesToday,
      cashBalance,
      cashOpen: !!openCash,
      // Bloco 2
      pendingOrders,
      pendingAmount,
      overdueCount: overdueList.length,
      overdueAmount,
      overdueList: overdueList.slice(0, 20),
      payablesCount,
      payablesAmount,
      platesMonth,
      lowStockCount,
      lowStockNames,
      // Mix de receita do mês
      mixBalcao: mixBalcao._sum?.totalAmount ?? 0,
      mixFrota: mixFrota._sum?.totalAmount ?? 0,
      // Estoque
      stockSnapshot,
      stockValue: Math.round(stockValue * 100) / 100,
      stockSpentThisMonth: Math.round(stockSpentThisMonth * 100) / 100,
      avgEfficiency,
      // Admin: Visão Financeira
      monthRevenue,
      prevMonthRevenue,
      avgTicket,
      projectedRevenue,
      monthExpenses,
      topClients,
      // Extras
      chartData,
      latestOrders: latestOrders?.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name ?? '-',
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
      })) ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
