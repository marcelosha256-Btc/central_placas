export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { customerName, periodStart, periodEnd, placas, totalAberto } = await req.json();

    // Montar dados para a planilha
    const rows = (placas || []).map((p: any) => ({
      'Data': p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-',
      'Pedido': `#${p.orderNumber || '-'}`,
      'Placa': p.plateNumber || '-',
      'Produto': p.product || '-',
      'Status': p.status || '-',
      'Valor (R$)': Number(p.unitPrice || 0).toFixed(2).replace('.', ','),
    }));

    // Adicionar linha de total
    rows.push({
      'Data': '',
      'Pedido': '',
      'Placa': '',
      'Produto': '',
      'Status': 'TOTAL EM ABERTO',
      'Valor (R$)': Number(totalAberto || 0).toFixed(2).replace('.', ','),
    });

    const wb = XLSX.utils.book_new();

    // Header info sheet data
    const infoData = [
      ['CENTRAL.PLACAS — Relatório de Placas'],
      [`Cliente: ${customerName}`],
      [`Período: ${periodStart} a ${periodEnd}`],
      [`Quantidade de placas: ${(placas || []).length}`],
      [`Total em aberto: R$ ${Number(totalAberto || 0).toFixed(2).replace('.', ',')}`],
      [],
    ];

    const wsData = [...infoData, Object.keys(rows[0] || {}), ...rows.map((r: any) => Object.values(r))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[ENVIO-MENSAL] XLS error:', error);
    return NextResponse.json({ error: 'Erro ao gerar XLS' }, { status: 500 });
  }
}
