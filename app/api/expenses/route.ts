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
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const summary = searchParams.get('summary') ?? '';

  const where: any = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      where.date.lt = to;
    }
  }
  if (category) where.category = category;
  if (status) where.status = status;

  // Summary mode - returns totals by status and category
  if (summary === '1') {
    const [totalPendente, totalPago, byCategory] = await Promise.all([
      prisma.expense.aggregate({ where: { ...where, status: 'PENDENTE' }, _sum: { amount: true }, _count: true }),
      prisma.expense.aggregate({ where: { ...where, status: 'PAGO' }, _sum: { amount: true }, _count: true }),
      prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: true, orderBy: { _sum: { amount: 'desc' } } }),
    ]);
    return NextResponse.json({
      totalPendente: totalPendente._sum.amount ?? 0,
      countPendente: totalPendente._count ?? 0,
      totalPago: totalPago._sum.amount ?? 0,
      countPago: totalPago._count ?? 0,
      byCategory,
    });
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({ expenses, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { description, amount, category, supplier, dueDate, date, status: expStatus } = await req.json();
    if (!description || !amount) return NextResponse.json({ error: 'Descrição e valor obrigatórios' }, { status: 400 });

    const isPago = expStatus === 'PAGO';

    // Se marcar como pago, exigir caixa aberto
    if (isPago) {
      const openCash = await prisma.cashRegister.findFirst({ where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } } });
      if (!openCash) {
        return NextResponse.json({ error: 'Caixa fechado. Abra o caixa antes de registrar pagamentos.' }, { status: 400 });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        description: upper(description),
        amount: parseFloat(String(amount)) || 0,
        category: category ?? 'Outros',
        supplier: upper(supplier ?? ''),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: isPago ? 'PAGO' : 'PENDENTE',
        paidAt: isPago ? new Date() : null,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Add to cash register if paid immediately
    if (isPago) {
      const openCash = await prisma.cashRegister.findFirst({ where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } } });
      if (openCash) {
        await prisma.cashMovement.create({
          data: {
            cashRegisterId: openCash.id,
            type: 'SAIDA',
            amount: parseFloat(String(amount)) || 0,
            description: `Despesa: ${description}`,
          },
        });
      }
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, action, description, amount, category, supplier, dueDate, date } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });

    // Mark as paid
    if (action === 'pay') {
      // Exigir caixa aberto para registrar pagamento
      const openCash = await prisma.cashRegister.findFirst({ where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } } });
      if (!openCash) {
        return NextResponse.json({ error: 'Caixa fechado. Abra o caixa antes de registrar pagamentos.' }, { status: 400 });
      }

      const updated = await prisma.expense.update({
        where: { id },
        data: { status: 'PAGO', paidAt: new Date() },
      });

      // Add to cash register
      if (openCash) {
        await prisma.cashMovement.create({
          data: {
            cashRegisterId: openCash.id,
            type: 'SAIDA',
            amount: existing.amount,
            description: `Despesa: ${existing.description}`,
          },
        });
      }

      return NextResponse.json(updated);
    }

    // Mark as pending (revert payment)
    if (action === 'revert') {
      const updated = await prisma.expense.update({
        where: { id },
        data: { status: 'PENDENTE', paidAt: null },
      });
      return NextResponse.json(updated);
    }

    // Edit expense
    const data: any = {};
    if (description !== undefined) data.description = upper(description);
    if (amount !== undefined) data.amount = parseFloat(String(amount)) || 0;
    if (category !== undefined) data.category = category;
    if (supplier !== undefined) data.supplier = upper(supplier);
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (date !== undefined) data.date = date ? new Date(date) : new Date();

    const updated = await prisma.expense.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
