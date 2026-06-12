export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Apenas admin pode acessar auditoria
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito ao administrador' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const userId = searchParams.get('userId');
    const orderId = searchParams.get('orderId');
    const orderNumber = searchParams.get('orderNumber');
    const action = searchParams.get('action');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 30;

    const where: any = {};

    // Se nenhuma ação específica foi selecionada, mostrar apenas EXCLUSAO e ALTERACAO
    if (!action) {
      where.action = { in: ['EXCLUSAO', 'ALTERACAO'] };
    }

    if (dateFrom) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(dateFrom + 'T00:00:00-03:00') };
    }
    if (dateTo) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(dateTo + 'T23:59:59-03:00') };
    }
    if (userId) where.userId = userId;
    if (action) where.action = action;

    // Se buscar por número do pedido, primeiro encontrar o orderId
    if (orderNumber) {
      const order = await prisma.order.findFirst({
        where: { orderNumber: parseInt(orderNumber) },
        select: { id: true },
      });
      if (order) {
        where.orderId = order.id;
      } else {
        return NextResponse.json({ audits: [], total: 0, page: 1, totalPages: 0 });
      }
    } else if (orderId) {
      where.orderId = orderId;
    }

    const [audits, total] = await Promise.all([
      prisma.orderAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: { orderNumber: true, customer: { select: { name: true } } },
          },
        },
      }),
      prisma.orderAudit.count({ where }),
    ]);

    return NextResponse.json({
      audits,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('Audit API error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
