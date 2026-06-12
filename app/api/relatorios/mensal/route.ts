export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMonthlyReportData } from '@/lib/monthly-report';

// GET - buscar dados agrupados por cliente (com saldo anterior)
// O cálculo vive em lib/monthly-report.ts (mesma fonte usada pelos PDFs/XLS).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const situacao = url.searchParams.get('situacao') || 'aberto';
    const apenasEnvioMensal = url.searchParams.get('apenasEnvioMensal') === '1';
    const clienteId = url.searchParams.get('clienteId') || '';

    const result = await getMonthlyReportData({ dateFrom, dateTo, situacao, apenasEnvioMensal, clienteId });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[RELATORIO-MENSAL] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}

// POST - marcar envio
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, customerId, periodStart, periodEnd, totalAmount, plateCount, sentVia } = body ?? {};

    if (action === 'markSent') {
      if (!customerId || !periodStart || !periodEnd) {
        return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
      }
      const send = await prisma.monthlySend.create({
        data: {
          customerId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          totalAmount: totalAmount ?? 0,
          plateCount: plateCount ?? 0,
          sentVia: sentVia ?? 'WHATSAPP',
        },
      });
      return NextResponse.json({ success: true, send });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[RELATORIO-MENSAL] POST error:', error);
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
  }
}
