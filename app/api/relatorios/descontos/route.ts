export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const userId = searchParams.get('userId');
    const customerId = searchParams.get('customerId');

    const where: any = {};

    if (dateFrom) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(dateFrom + 'T00:00:00-03:00') };
    }
    if (dateTo) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(dateTo + 'T23:59:59-03:00') };
    }
    if (userId) where.userId = userId;
    if (customerId) where.customerId = customerId;

    const discounts = await prisma.invoiceDiscount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const total = discounts.reduce((s: number, d: any) => s + d.amount, 0);

    return NextResponse.json({ discounts, total });
  } catch (err: any) {
    console.error('Discount report API error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
