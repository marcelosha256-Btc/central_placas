export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { clients, dateFrom, dateTo, totalRestante } = await req.json();

    const fmtCur = (v: number) => Number(v || 0).toFixed(2).replace('.', ',');
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';

    const rows: any[][] = [
      ['CENTRAL.PLACAS — Contas a Receber'],
      [`Período: ${dateFrom || '-'} a ${dateTo || '-'}`],
      [`Total a receber: R$ ${fmtCur(totalRestante)}`],
      [],
      ['Cliente', 'CPF/CNPJ', 'Pedido', 'Data', 'Placa', 'Produto', 'Qtd', 'Valor (R$)', 'Pago (R$)', 'Restante (R$)', 'Pagamentos'],
    ];

    for (const c of (clients || [])) {
      // Linha do cliente (resumo)
      rows.push([c.customerName, c.customerDocument || '-', '', '', '', '', '', `R$ ${fmtCur(c.totalAmount)}`, `R$ ${fmtCur(c.paidAmount)}`, `R$ ${fmtCur(c.remaining)}`, '']);

      for (const order of (c.orders || [])) {
        const pagamentos = (order.payments || []).map((p: any) => `R$ ${fmtCur(p.amount)} (${p.paymentMethod}) ${fmtDate(p.createdAt)}`).join('; ');

        for (const it of (order.items || [])) {
          rows.push([
            '',
            '',
            `#${order.orderNumber}`,
            fmtDate(order.createdAt),
            it.plateNumber || '-',
            it.product || '-',
            it.quantity || 1,
            `R$ ${fmtCur(it.unitPrice)}`,
            `R$ ${fmtCur(order.paidAmount)}`,
            `R$ ${fmtCur(order.remaining)}`,
            pagamentos,
          ]);
        }
      }
    }

    // Linha total
    rows.push([]);
    rows.push(['', '', '', '', '', '', 'TOTAL A RECEBER', '', '', `R$ ${fmtCur(totalRestante)}`, '']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 25 },
      { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="contas_receber_${dateFrom}_${dateTo}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[RECEIVABLES] XLS error:', error);
    return NextResponse.json({ error: 'Erro ao gerar XLS' }, { status: 500 });
  }
}
