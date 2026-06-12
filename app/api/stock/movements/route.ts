export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { recordMovement } from '@/lib/stock';

// GET — extrato de movimentações de estoque (filtros: productId, type, período)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId') ?? '';
  const type = searchParams.get('type') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const limit = parseInt(searchParams.get('limit') ?? '100');

  const where: any = {};
  if (productId) where.productId = productId;
  if (type) where.type = type;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + 'T00:00:00-03:00');
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59-03:00');
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { product: { select: { code: true, description: true } } },
  });

  return NextResponse.json({ movements });
}

// POST — estorna uma avaria (cria ENTRADA e marca reversed=true)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { movementId } = await req.json() ?? {};
    if (!movementId) return NextResponse.json({ error: 'movementId obrigatório' }, { status: 400 });

    const movement = await prisma.stockMovement.findUnique({ where: { id: movementId } });
    if (!movement) return NextResponse.json({ error: 'Movimento não encontrado' }, { status: 404 });
    if (movement.type !== 'AVARIA') return NextResponse.json({ error: 'Só é possível estornar avarias' }, { status: 400 });
    if (movement.reversed) return NextResponse.json({ error: 'Avaria já estornada' }, { status: 400 });

    const userId = (session.user as any)?.id ?? '';
    const userName = (session.user as any)?.name ?? '';

    const newBalance = await prisma.$transaction(async (tx) => {
      const balance = await recordMovement(tx, {
        productId: movement.productId,
        type: 'ENTRADA',
        quantity: movement.quantity,
        reason: `Estorno avaria: ${movement.reason}`,
        userId,
        userName,
      });
      await tx.stockMovement.update({ where: { id: movementId }, data: { reversed: true } });
      return balance;
    });

    return NextResponse.json({ ok: true, balance: newBalance }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao estornar avaria' }, { status: 500 });
  }
}
