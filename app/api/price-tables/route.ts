export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upper } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');

  if (all === '1') {
    const tables = await prisma.priceTable.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return NextResponse.json(tables);
  }

  const tables = await prisma.priceTable.findMany({
    orderBy: { name: 'asc' },
    include: { items: { include: { product: true } }, _count: { select: { customers: true } } },
  });
  return NextResponse.json(tables);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    const table = await prisma.priceTable.create({ data: { name: upper(name) } });
    return NextResponse.json(table, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'P2002') return NextResponse.json({ error: 'Nome já existe' }, { status: 409 });
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, name, items } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    if (name) {
      await prisma.priceTable.update({ where: { id }, data: { name: upper(name) } });
    }

    // Update price items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item?.productId) continue;
        await prisma.priceTableItem.upsert({
          where: { priceTableId_productId: { priceTableId: id, productId: item.productId } },
          create: { priceTableId: id, productId: item.productId, price: parseFloat(item.price) || 0 },
          update: { price: parseFloat(item.price) || 0 },
        });
      }
    }

    const table = await prisma.priceTable.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
    return NextResponse.json(table);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  try {
    await prisma.priceTable.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível excluir. Tabela pode ter clientes vinculados.' }, { status: 500 });
  }
}
