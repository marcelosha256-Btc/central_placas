export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upper } from '@/lib/utils';
import { applyStockForOrder, reverseStockForOrder } from '@/lib/stock';

// Helper: cria snapshot JSON do pedido para auditoria
function orderSnapshot(order: any) {
  return JSON.stringify({
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    plateNumber: order.plateNumber,
    notes: order.notes,
    items: (order.items ?? []).map((it: any) => ({
      productId: it.productId,
      description: it.description,
      plateNumber: it.plateNumber,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    })),
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const status = searchParams.get('status') ?? '';
  const customerId = searchParams.get('customerId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const id = searchParams.get('id') ?? '';
  const searchPlate = searchParams.get('plate') ?? '';

  // Detalhe de um pedido específico
  if (id) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        user: { select: { name: true } },
      },
    });
    return NextResponse.json(order);
  }

  // Filtrar pedidos deletados por padrão
  const where: any = { deleted: false };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + 'T00:00:00-03:00');
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59-03:00');
  }

  // Busca por placa
  if (searchPlate) {
    const plateSearch = searchPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    where.OR = [
      { plateNumber: { contains: plateSearch, mode: 'insensitive' } },
      { items: { some: { plateNumber: { contains: plateSearch, mode: 'insensitive' } } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { customerId, plateNumber, items, notes } = body ?? {};
    if (!customerId || !(items ?? [])?.length) {
      return NextResponse.json({ error: 'Cliente e pelo menos um item são obrigatórios' }, { status: 400 });
    }

    const userId = (session.user as any)?.id;
    let totalAmount = 0;
    const orderItems: any[] = [];
    for (const item of items ?? []) {
      const tp = (item?.quantity ?? 1) * (item?.unitPrice ?? 0);
      totalAmount += tp;
      orderItems.push({
        productId: item?.productId,
        description: upper(item?.description ?? ''),
        plateNumber: upper(item?.plateNumber ?? ''),
        quantity: item?.quantity ?? 1,
        unitPrice: item?.unitPrice ?? 0,
        totalPrice: tp,
      });
    }

    const userName = (session.user as any)?.name ?? '';

    // Cria o pedido e dá baixa no estoque de forma atômica
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId,
          userId,
          plateNumber: upper(plateNumber ?? ''),
          totalAmount,
          notes: upper(notes ?? ''),
          items: { create: orderItems },
        },
        include: { items: true },
      });
      await applyStockForOrder(tx, created.id, created.orderNumber, orderItems, userId, userName);
      return created;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    console.error('Order create error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro ao criar pedido' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, customerId, plateNumber, notes, items, reason } = body ?? {};
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (existing.deleted) return NextResponse.json({ error: 'Pedido excluído não pode ser editado' }, { status: 400 });

    // === EDIÇÃO DO PEDIDO ===
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Itens são obrigatórios para edição' }, { status: 400 });
    }

    // Snapshot do pedido ANTES da alteração
    const snapshot = orderSnapshot(existing);

    let newTotal = 0;
    const newItems: any[] = [];
    for (const item of items) {
      const tp = (item?.quantity ?? 1) * (item?.unitPrice ?? 0);
      newTotal += tp;
      newItems.push({
        productId: item?.productId,
        description: upper(item?.description ?? ''),
        plateNumber: upper(item?.plateNumber ?? ''),
        quantity: item?.quantity ?? 1,
        unitPrice: item?.unitPrice ?? 0,
        totalPrice: tp,
      });
    }

    if (newTotal < (existing.paidAmount ?? 0) - 0.01) {
      return NextResponse.json(
        { error: `O total do pedido (R$ ${newTotal.toFixed(2)}) não pode ser menor que o valor já recebido (R$ ${(existing.paidAmount ?? 0).toFixed(2)})` },
        { status: 400 }
      );
    }

    const newStatus = newTotal <= (existing.paidAmount ?? 0) + 0.01 ? 'PAGO' : 'ABERTO';
    const userId = (session.user as any)?.id ?? '';
    const userName = (session.user as any)?.name ?? '';

    // Reconcilia tudo numa transação: estorna a baixa antiga, troca os itens,
    // re-aplica a baixa com os itens novos e registra a auditoria.
    const order = await prisma.$transaction(async (tx) => {
      await reverseStockForOrder(tx, id, existing.orderNumber, userId, userName);

      await tx.orderItem.deleteMany({ where: { orderId: id } });

      const updated = await tx.order.update({
        where: { id },
        data: {
          customerId: customerId ?? existing.customerId,
          plateNumber: plateNumber !== undefined ? upper(plateNumber) : existing.plateNumber,
          notes: notes !== undefined ? upper(notes) : existing.notes,
          totalAmount: newTotal,
          paidAmount: existing.paidAmount,
          status: newStatus,
          items: { create: newItems },
        },
        include: { items: true },
      });

      await applyStockForOrder(tx, id, existing.orderNumber, newItems, userId, userName);

      await tx.orderAudit.create({
        data: {
          orderId: id,
          userId,
          userName,
          action: 'ALTERACAO',
          reason: reason || 'Edição de itens do pedido',
          previousData: snapshot,
        },
      });

      return updated;
    });

    return NextResponse.json(order);
  } catch (err: any) {
    console.error('Order update error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id ?? '';
    const reason = body?.reason ?? '';

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Motivo da exclusão é obrigatório (mínimo 5 caracteres)' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (existing.deleted) return NextResponse.json({ error: 'Pedido já está excluído' }, { status: 400 });

    const userId = (session.user as any)?.id ?? '';
    const userName = (session.user as any)?.name ?? '';

    // Snapshot antes da exclusão
    const snapshot = orderSnapshot(existing);

    // Soft delete + estorno do estoque + auditoria, de forma atômica
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          deleted: true,
          deletedAt: new Date(),
          deletedById: userId,
          deleteReason: reason.trim(),
        },
      });

      await reverseStockForOrder(tx, id, existing.orderNumber, userId, userName);

      await tx.orderAudit.create({
        data: {
          orderId: id,
          userId,
          userName,
          action: 'EXCLUSAO',
          reason: reason.trim(),
          previousData: snapshot,
        },
      });
    });

    return NextResponse.json({ ok: true, message: 'Pedido excluído com sucesso' });
  } catch (err: any) {
    console.error('Order delete error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro ao excluir' }, { status: 500 });
  }
}
