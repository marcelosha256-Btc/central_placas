export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcBalance } from '@/lib/calc-balance';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const history = searchParams.get('history');
  const lastClosed = searchParams.get('lastClosed');

  // Saldo do último caixa fechado
  if (lastClosed === '1') {
    const last = await prisma.cashRegister.findFirst({
      where: { status: 'FECHADO' },
      orderBy: { closeDate: 'desc' },
    });
    const lastClosedBalance = last ? (last.countedBalance ?? last.finalBalance ?? 0) : 0;
    return NextResponse.json({
      lastClosedBalance,
      lastResponsible: last?.responsible ?? '',
      lastCloseDate: last?.closeDate ?? null,
      lastOpenDate: last?.openDate ?? null,
    });
  }

  // Histórico de caixas anteriores
  if (history === '1') {
    const registers = await prisma.cashRegister.findMany({
      orderBy: { openDate: 'desc' },
      take: 30,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ registers });
  }

  // Caixa atual (aberto ou em conferência)
  const current = await prisma.cashRegister.findFirst({
    where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
    orderBy: { openDate: 'desc' },
    include: {
      movements: { orderBy: { createdAt: 'desc' } },
      user: { select: { name: true } },
    },
  });

  if (!current) return NextResponse.json({ open: false, register: null });

  const { balance, totalEntradas, totalSaidas } = calcBalance(current);

  return NextResponse.json({
    open: true,
    register: {
      ...current,
      currentBalance: balance,
      totalEntradas,
      totalSaidas,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;
    const userId = (session.user as any)?.id;

    // Ações de abrir/fechar/reabrir restritas a admin
    const userRole = (session.user as any)?.role ?? '';
    const adminActions = ['open', 'close', 'reopen'];
    if (adminActions.includes(action) && userRole !== 'admin') {
      return NextResponse.json({ error: 'Somente administradores podem abrir/fechar/reabrir o caixa.' }, { status: 403 });
    }

    // === ABRIR CAIXA ===
    if (action === 'open') {
      const { initialBalance, responsible } = body;
      const existing = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (existing) return NextResponse.json({ error: 'Já existe um caixa aberto' }, { status: 400 });

      const register = await prisma.cashRegister.create({
        data: {
          userId,
          initialBalance: parseFloat(String(initialBalance)) || 0,
          responsible: responsible ?? '',
        },
      });
      return NextResponse.json(register, { status: 201 });
    }

    // === ABRIR PRÓXIMO DIA (herança de saldo) ===
    if (action === 'openNextDay') {
      // Busca o último caixa fechado
      const lastClosed = await prisma.cashRegister.findFirst({
        where: { status: 'FECHADO' },
        orderBy: { closeDate: 'desc' },
      });
      if (!lastClosed) return NextResponse.json({ error: 'Nenhum caixa fechado encontrado' }, { status: 400 });

      const existing = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (existing) return NextResponse.json({ error: 'Já existe um caixa aberto' }, { status: 400 });

      // Usa o saldo conferido do dia anterior como saldo inicial
      const inheritedBalance = lastClosed.countedBalance ?? lastClosed.finalBalance ?? 0;

      const register = await prisma.cashRegister.create({
        data: {
          userId,
          initialBalance: inheritedBalance,
          responsible: body.responsible ?? lastClosed.responsible ?? '',
        },
      });
      return NextResponse.json({ register, inheritedBalance }, { status: 201 });
    }

    // === SALVAR CAIXA (conferência sem fechar) ===
    if (action === 'save') {
      const { responsible, countedBalance, closingNotes } = body;
      const current = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
        include: { movements: true },
      });
      if (!current) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });

      const { balance } = calcBalance(current);
      const counted = countedBalance !== null && countedBalance !== undefined
        ? parseFloat(String(countedBalance))
        : null;
      const diff = counted !== null ? counted - balance : 0;

      const register = await prisma.cashRegister.update({
        where: { id: current.id },
        data: {
          status: 'EM_CONFERENCIA',
          responsible: responsible ?? current.responsible ?? '',
          countedBalance: counted,
          difference: diff,
          closingNotes: closingNotes ?? '',
        },
      });
      return NextResponse.json(register);
    }

    // === FECHAR CAIXA (com conferência obrigatória) ===
    if (action === 'close') {
      const { responsible, countedBalance, closingNotes } = body;
      const current = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
        include: { movements: true },
      });
      if (!current) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });

      const counted = countedBalance !== null && countedBalance !== undefined
        ? parseFloat(String(countedBalance))
        : null;

      if (counted === null) {
        return NextResponse.json({ error: 'Informe o valor conferido para fechar o caixa' }, { status: 400 });
      }

      const { balance } = calcBalance(current);
      const diff = counted - balance;

      // Se há diferença, exige observação
      if (Math.abs(diff) >= 0.01 && !(closingNotes ?? '').trim()) {
        return NextResponse.json(
          { error: 'Existe diferença entre o saldo e o valor conferido. Informe uma observação.' },
          { status: 400 }
        );
      }

      const register = await prisma.cashRegister.update({
        where: { id: current.id },
        data: {
          status: 'FECHADO',
          closeDate: new Date(),
          finalBalance: balance,
          countedBalance: counted,
          difference: diff,
          responsible: responsible ?? current.responsible ?? '',
          closingNotes: closingNotes ?? '',
        },
      });
      return NextResponse.json(register);
    }

    // === REABRIR CAIXA ===
    if (action === 'reopen') {
      const { reopenReason, registerId } = body;
      if (!reopenReason?.trim()) {
        return NextResponse.json({ error: 'Informe o motivo da reabertura' }, { status: 400 });
      }

      const target = registerId
        ? await prisma.cashRegister.findUnique({ where: { id: registerId } })
        : await prisma.cashRegister.findFirst({
            where: { status: 'FECHADO' },
            orderBy: { closeDate: 'desc' },
          });

      if (!target || target.status !== 'FECHADO') {
        return NextResponse.json({ error: 'Caixa não está fechado' }, { status: 400 });
      }

      // Verifica se não há outro caixa aberto
      const openExists = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (openExists) {
        return NextResponse.json({ error: 'Feche o caixa atual antes de reabrir outro' }, { status: 400 });
      }

      const register = await prisma.cashRegister.update({
        where: { id: target.id },
        data: {
          status: 'ABERTO',
          closeDate: null,
          reopenReason,
          countedBalance: null,
          difference: 0,
        },
      });
      return NextResponse.json(register);
    }

    // === MOVIMENTAÇÃO (sangria/suprimento) ===
    if (action === 'movement') {
      const { amount, description, type } = body;
      const current = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (!current) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });

      const movement = await prisma.cashMovement.create({
        data: {
          cashRegisterId: current.id,
          type: type ?? 'ENTRADA',
          amount: parseFloat(String(amount)) || 0,
          description: description ?? '',
        },
      });
      return NextResponse.json(movement, { status: 201 });
    }

    // === ESTORNO DE MOVIMENTAÇÃO ===
    if (action === 'reverse') {
      const { movementId, reason } = body;
      if (!reason?.trim()) {
        return NextResponse.json({ error: 'Informe o motivo do estorno' }, { status: 400 });
      }

      const current = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (!current) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });

      const movement = await prisma.cashMovement.findUnique({ where: { id: movementId } });
      if (!movement || movement.cancelled) {
        return NextResponse.json({ error: 'Movimentação não encontrada ou já estornada' }, { status: 400 });
      }

      // Marca o movimento original como cancelado
      await prisma.cashMovement.update({
        where: { id: movementId },
        data: { cancelled: true, cancelReason: reason },
      });

      // Cria movimento inverso (estorno)
      const isEntry = movement.type === 'ENTRADA' || movement.type === 'SUPRIMENTO';
      const reversal = await prisma.cashMovement.create({
        data: {
          cashRegisterId: current.id,
          type: 'ESTORNO',
          amount: isEntry ? -(movement.amount) : movement.amount,
          description: `Estorno: ${movement.description}`,
          refMovementId: movementId,
          paymentMethod: movement.paymentMethod,
          orderId: movement.orderId,
        },
      });

      return NextResponse.json(reversal, { status: 201 });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('Cash API error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
