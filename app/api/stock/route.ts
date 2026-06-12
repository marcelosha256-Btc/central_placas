export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upper } from '@/lib/utils';
import { recordMovement } from '@/lib/stock';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { trackStock: true },
    orderBy: { description: 'asc' },
    select: {
      id: true, code: true, description: true, category: true,
      stockQuantity: true, minStock: true, basePrice: true, active: true,
      leadTimeDays: true,
    },
  });

  const since60 = new Date();
  since60.setDate(since60.getDate() - 60);

  // Enriquece cada produto com custo médio ponderado + métricas de consumo
  const enriched = await Promise.all(products.map(async (p) => {
    // Custo médio ponderado: entradas que tiveram unitCost informado
    const entries = await prisma.stockMovement.findMany({
      where: { productId: p.id, type: 'ENTRADA', unitCost: { not: null } },
      select: { quantity: true, unitCost: true },
    });
    const totalEntryQty = entries.reduce((s, e) => s + e.quantity, 0);
    const totalEntryCost = entries.reduce((s, e) => s + e.quantity * (e.unitCost ?? 0), 0);
    const avgCost = totalEntryQty > 0 ? totalEntryCost / totalEntryQty : 0;

    // Consumo nos últimos 60 dias (SAIDAs não estornadas)
    const consumedAgg = await prisma.stockMovement.aggregate({
      where: { productId: p.id, type: 'SAIDA', reversed: false, createdAt: { gte: since60 } },
      _sum: { quantity: true },
    });
    const consumed60 = consumedAgg._sum?.quantity ?? 0;
    const dailyAvg = consumed60 / 60;

    // Avarias nos últimos 60 dias → taxa de aproveitamento
    const avariaAgg = await prisma.stockMovement.aggregate({
      where: { productId: p.id, type: 'AVARIA', createdAt: { gte: since60 } },
      _sum: { quantity: true },
    });
    const avaria60 = avariaAgg._sum?.quantity ?? 0;
    const totalOut60 = consumed60 + avaria60;
    const efficiency = totalOut60 > 0 ? Math.round((consumed60 / totalOut60) * 100) : null;

    // Estoque comprometido: pedidos ABERTO com itens vinculados a esta chapa
    const committedItems = await prisma.orderItem.findMany({
      where: {
        order: { deleted: false, status: 'ABERTO' },
        product: { stockItemId: p.id },
      },
      select: { quantity: true, product: { select: { consumptionQty: true } } },
    });
    const committedQty = committedItems.reduce((s, it) => s + it.quantity * (it.product.consumptionQty ?? 1), 0);
    const availableQty = (p.stockQuantity ?? 0) - committedQty;

    // Dias restantes calculados sobre saldo disponível (não comprometido)
    const leadTimeDays = p.leadTimeDays ?? 7;
    const daysRemaining = dailyAvg > 0.01 ? Math.floor(availableQty / dailyAvg) : null;
    const suggestedOrder30 = dailyAvg > 0.01
      ? Math.max(0, Math.ceil(dailyAvg * 30) - availableQty)
      : 0;
    // Alerta urgente: dias restantes <= lead time do fornecedor
    const overCommitted = availableQty < 0;
    const orderUrgent = !overCommitted && daysRemaining !== null && daysRemaining <= leadTimeDays;
    const orderSoon   = !overCommitted && daysRemaining !== null && daysRemaining <= leadTimeDays + 7 && !orderUrgent;

    return {
      ...p,
      avgCost: Math.round(avgCost * 100) / 100,
      stockValueReal: Math.round((p.stockQuantity ?? 0) * avgCost * 100) / 100,
      dailyAvg: Math.round(dailyAvg * 10) / 10,
      consumed60: Math.round(consumed60),
      avaria60: Math.round(avaria60),
      efficiency,
      committedQty: Math.round(committedQty),
      availableQty: Math.round(availableQty),
      daysRemaining,
      suggestedOrder30,
      orderUrgent,
      orderSoon,
      overCommitted,
    };
  }));

  // Resumo geral
  let belowMin = 0;
  let overCommittedCount = 0;
  let totalStockValue = 0;
  let totalQty = 0;
  let totalAvailable = 0;
  let totalCommitted = 0;
  let minDays: number | null = null;
  let minDaysProduct = '';

  for (const p of enriched) {
    if (p.overCommitted) overCommittedCount++;
    else if ((p.availableQty ?? 0) <= (p.minStock ?? 0)) belowMin++;
    totalStockValue += p.stockValueReal;
    totalQty += p.stockQuantity ?? 0;
    totalAvailable += p.availableQty;
    totalCommitted += p.committedQty;
    if (p.daysRemaining !== null) {
      if (minDays === null || p.daysRemaining < minDays) {
        minDays = p.daysRemaining;
        minDaysProduct = p.description;
      }
    }
  }

  return NextResponse.json({
    products: enriched,
    summary: {
      total: enriched.length,
      belowMin,
      overCommittedCount,
      totalQty,
      totalAvailable,
      totalCommitted,
      stockValue: Math.round(totalStockValue * 100) / 100,
      minDays,
      minDaysProduct,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, type, quantity, newCount, reason, unitCost } = body ?? {};
    if (!productId) return NextResponse.json({ error: 'Produto obrigatório' }, { status: 400 });
    if (type !== 'ENTRADA' && type !== 'AJUSTE' && type !== 'AVARIA') {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const userId = (session.user as any)?.id ?? '';
    const userName = (session.user as any)?.name ?? '';

    let movInput: any;
    if (type === 'ENTRADA') {
      const qty = parseFloat(quantity);
      if (!qty || qty <= 0) return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 });
      movInput = {
        productId, type: 'ENTRADA', quantity: qty,
        reason: upper(reason || 'Compra/entrada de estoque'),
        unitCost: unitCost != null && unitCost !== '' ? parseFloat(unitCost) : null,
        userId, userName,
      };
    } else if (type === 'AVARIA') {
      const qty = parseFloat(quantity);
      if (!qty || qty <= 0) return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 });
      movInput = {
        productId, type: 'AVARIA', quantity: qty,
        reason: upper(reason || 'Avaria registrada'),
        userId, userName,
      };
    } else {
      const count = parseFloat(newCount);
      if (isNaN(count) || count < 0) return NextResponse.json({ error: 'Contagem inválida' }, { status: 400 });
      const delta = count - (product.stockQuantity ?? 0);
      if (Math.abs(delta) < 0.0001) {
        return NextResponse.json({ error: 'A contagem informada é igual ao saldo atual' }, { status: 400 });
      }
      movInput = {
        productId, type: 'AJUSTE', quantity: delta,
        reason: upper(reason || 'Ajuste de inventário'),
        userId, userName,
      };
    }

    const newBalance = await prisma.$transaction(async (tx) => {
      if (!product.trackStock) {
        await tx.product.update({ where: { id: productId }, data: { trackStock: true } });
      }
      return recordMovement(tx, movInput);
    });

    return NextResponse.json({ ok: true, balance: newBalance }, { status: 201 });
  } catch (err: any) {
    console.error('Stock movement error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro ao registrar movimento' }, { status: 500 });
  }
}
