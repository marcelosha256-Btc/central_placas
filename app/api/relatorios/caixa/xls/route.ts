export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

function fmtDateTime(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtTime(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function typeLabel(t: string) {
  switch (t) {
    case 'ENTRADA': return 'Entrada';
    case 'SAIDA': return 'Saída';
    case 'SUPRIMENTO': return 'Suprimento';
    case 'SANGRIA': return 'Sangria';
    default: return t;
  }
}

function statusLabel(s: string) {
  if (s === 'FECHADO') return 'Fechado';
  if (s === 'EM_CONFERENCIA') return 'Em Conferência';
  return 'Aberto';
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { data, summary, viewLabel } = await req.json();

    const wb = XLSX.utils.book_new();

    // ---- Sheet 1: Resumo ----
    const summaryRows = (data || []).map((r: any) => ({
      'Abertura': fmtDateTime(r.openDate),
      'Fechamento': r.closeDate ? fmtDateTime(r.closeDate) : '-',
      'Responsável': r.responsible || '-',
      'Status': statusLabel(r.status),
      'Saldo Inicial (R$)': Number(r.initialBalance || 0).toFixed(2).replace('.', ','),
      'Entradas (R$)': Number(r.entradas || 0).toFixed(2).replace('.', ','),
      'Saídas (R$)': Number(r.saidas || 0).toFixed(2).replace('.', ','),
      'Saldo Final (R$)': Number(r.saldoSistema || 0).toFixed(2).replace('.', ','),
    }));

    summaryRows.push({
      'Abertura': '', 'Fechamento': '', 'Responsável': '', 'Status': 'TOTAIS',
      'Saldo Inicial (R$)': '',
      'Entradas (R$)': Number(summary?.totalEntradas || 0).toFixed(2).replace('.', ','),
      'Saídas (R$)': Number(summary?.totalSaidas || 0).toFixed(2).replace('.', ','),
      'Saldo Final (R$)': Number(summary?.saldoTotal || 0).toFixed(2).replace('.', ','),
    });

    const infoData: any[][] = [
      ['CENTRAL.PLACAS — Relatório de Caixa — ' + (viewLabel || 'Todos')],
      ['Registros: ' + (summary?.totalRegistros ?? 0)],
      [],
    ];

    const wsData = [...infoData, Object.keys(summaryRows[0] || {}), ...summaryRows.map((r: any) => Object.values(r))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');

    // ---- Sheet 2: Movimentos (all movements with register context) ----
    const movHeaders = ['Caixa #', 'Responsável', 'Abertura', 'Hora', 'Tipo', 'Descrição', 'Forma Pgto', 'Valor (R$)'];
    const movRows: any[][] = [movHeaders];

    (data || []).forEach((r: any, idx: number) => {
      const movs = r.movements || [];
      if (movs.length === 0) return;
      movs.forEach((m: any) => {
        const isEntry = m.type === 'ENTRADA' || m.type === 'SUPRIMENTO';
        const prefix = isEntry ? '' : '-';
        movRows.push([
          idx + 1,
          r.responsible || '-',
          fmtDateTime(r.openDate),
          fmtTime(m.createdAt),
          typeLabel(m.type),
          m.description || '-',
          m.paymentMethod || '-',
          prefix + Number(m.amount || 0).toFixed(2).replace('.', ','),
        ]);
      });
    });

    const ws2 = XLSX.utils.aoa_to_sheet(movRows);
    ws2['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Movimentos');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="relatorio_caixa.xlsx"',
      },
    });
  } catch (error) {
    console.error('[RELATORIO-CAIXA] XLS error:', error);
    return NextResponse.json({ error: 'Erro ao gerar XLS' }, { status: 500 });
  }
}
