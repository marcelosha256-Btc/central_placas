export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get('dateFrom') ?? '';
    const dateTo = url.searchParams.get('dateTo') ?? '';
    const status = url.searchParams.get('status') ?? ''; // ABERTO, FECHADO, ou vazio=todos

    const where: any = {};

    // Filtro de período por data de abertura
    if (dateFrom || dateTo) {
      where.openDate = {};
      if (dateFrom) where.openDate.gte = new Date(dateFrom + 'T00:00:00-03:00');
      if (dateTo) where.openDate.lte = new Date(dateTo + 'T23:59:59-03:00');
    }

    // Filtro de status
    if (status === 'FECHADO') {
      where.status = 'FECHADO';
    } else if (status === 'ABERTO') {
      where.status = { in: ['ABERTO', 'EM_CONFERENCIA'] };
    }
    // vazio = todos os status

    const registers = await prisma.cashRegister.findMany({
      where,
      include: {
        user: { select: { name: true } },
        movements: {
          where: { cancelled: false },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { openDate: 'desc' },
      take: 200,
    });

    const data = registers.map((r: any) => {
      const entradas = r.movements
        .filter((m: any) => m.type === 'ENTRADA' || m.type === 'SUPRIMENTO')
        .reduce((acc: number, m: any) => acc + m.amount, 0);
      const saidas = r.movements
        .filter((m: any) => m.type === 'SAIDA' || m.type === 'SANGRIA')
        .reduce((acc: number, m: any) => acc + m.amount, 0);
      const saldoSistema = (r.initialBalance ?? 0) + entradas - saidas;

      return {
        id: r.id,
        openDate: r.openDate,
        closeDate: r.closeDate,
        status: r.status,
        responsible: r.responsible || r.user?.name || '-',
        initialBalance: r.initialBalance ?? 0,
        entradas,
        saidas,
        saldoSistema,
        countedBalance: r.countedBalance ?? null,
        difference: r.difference ?? 0,
        finalBalance: r.finalBalance ?? 0,
        closingNotes: r.closingNotes || '',
        movementCount: r.movements.length,
        movements: r.movements.map((m: any) => ({
          id: m.id,
          type: m.type,
          amount: m.amount,
          description: m.description,
          paymentMethod: m.paymentMethod || '-',
          createdAt: m.createdAt,
          attachmentUrl: m.attachmentUrl || null,
        })),
      };
    });

    const summary = {
      totalRegistros: data.length,
      totalEntradas: data.reduce((a: number, r: any) => a + r.entradas, 0),
      totalSaidas: data.reduce((a: number, r: any) => a + r.saidas, 0),
      saldoTotal: data.reduce((a: number, r: any) => a + r.saldoSistema, 0),
    };

    return NextResponse.json({ data, summary });
  } catch (error) {
    console.error('[RELATORIO-CAIXA] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}
