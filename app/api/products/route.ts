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
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const search = searchParams.get('search') ?? '';

  if (all === '1') {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { description: 'asc' },
      include: { stockItem: { select: { id: true, description: true, code: true } } },
    });
    return NextResponse.json(products);
  }

  const where: any = search ? { description: { contains: search, mode: 'insensitive' as any } } : {};
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { description: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { stockItem: { select: { id: true, description: true, code: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  return NextResponse.json({ products, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { code, description, category, basePrice, trackStock, minStock, stockItemId, consumptionQty, leadTimeDays } = body ?? {};
    if (!code || !description) return NextResponse.json({ error: 'Código e descrição obrigatórios' }, { status: 400 });
    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) return NextResponse.json({ error: 'Código já existe' }, { status: 409 });
    const product = await prisma.product.create({
      data: {
        code: upper(code),
        description: upper(description),
        category: category ?? 'Placa',
        basePrice: parseFloat(basePrice) || 0,
        trackStock: stockItemId ? false : !!trackStock,
        minStock: parseFloat(minStock) || 0,
        stockItemId: stockItemId || null,
        consumptionQty: parseFloat(consumptionQty) || 1,
        leadTimeDays: parseInt(leadTimeDays) || 7,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, code, description, category, basePrice, active, trackStock, minStock, stockItemId, consumptionQty, leadTimeDays } = body ?? {};
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    const data: any = {
      code: upper(code),
      description: upper(description),
      category,
      basePrice: parseFloat(basePrice) || 0,
      active: active ?? true,
    };
    if (stockItemId !== undefined) {
      data.stockItemId = stockItemId || null;
      data.consumptionQty = parseFloat(consumptionQty) || 1;
      if (stockItemId) data.trackStock = false;
    } else {
      if (trackStock !== undefined) data.trackStock = !!trackStock;
      if (minStock !== undefined) data.minStock = parseFloat(minStock) || 0;
      if (leadTimeDays !== undefined) data.leadTimeDays = parseInt(leadTimeDays) || 7;
    }
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
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
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível excluir. Produto pode estar vinculado a pedidos.' }, { status: 500 });
  }
}
