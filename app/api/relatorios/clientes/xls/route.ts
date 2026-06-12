export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { customerName, periodStart, periodEnd, placas, summary } = await req.json();

    const rows = (placas || []).map((p: any) => ({
      'Data': p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-',
      'Pedido': `#${p.orderNumber || '-'}`,
      'Placa': p.plateNumber || '-',
      'Produto': p.product || '-',
      'Status': p.status || '-',
      'Valor (R$)': Number(p.unitPrice || 0).toFixed(2).replace('.', ','),
    }));

    rows.push({
      'Data': '', 'Pedido': '', 'Placa': '', 'Produto': '',
      'Status': 'TOTAL EM ABERTO',
      'Valor (R$)': Number(summary?.totalAberto || 0).toFixed(2).replace('.', ','),
    });

    const wb = XLSX.utils.book_new();
    const infoData = [
      ['CENTRAL.PLACAS — Relatório de Clientes'],
      [`Cliente: ${customerName}`],
      [`Período: ${periodStart} a ${periodEnd}`],
      [`Pedidos: ${summary?.totalPedidos ?? 0} | Placas: ${summary?.totalPlacas ?? 0}`],
      [`Total Geral: R$ ${Number(summary?.totalGeral ?? 0).toFixed(2).replace('.', ',')} | Pago: R$ ${Number(summary?.totalPago ?? 0).toFixed(2).replace('.', ',')} | Aberto: R$ ${Number(summary?.totalAberto ?? 0).toFixed(2).replace('.', ',')}`],
      [],
    ];

    const wsData = [...infoData, Object.keys(rows[0] || {}), ...rows.map((r: any) => Object.values(r))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio_cliente_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[RELATORIO-CLIENTES] XLS error:', error);
    return NextResponse.json({ error: 'Erro ao gerar XLS' }, { status: 500 });
  }
}
