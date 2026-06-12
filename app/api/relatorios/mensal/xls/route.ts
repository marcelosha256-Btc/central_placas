export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMonthlyReportData, formatPeriodDate } from '@/lib/monthly-report';
import * as XLSX from 'xlsx';

function paymentMethodLabel(m: string) {
  const map: Record<string, string> = {
    'Dinheiro': 'Dinheiro', 'PIX': 'PIX', 'Cartão Crédito': 'Cartão Crédito',
    'Cartão Débito': 'Cartão Débito', 'Transferência': 'Transferência', 'Boleto': 'Boleto',
    'A_PRAZO': 'A Prazo',
  };
  return map[m] || m || '-';
}

function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function fmtMoney(v: number) {
  return Number(v || 0).toFixed(2).replace('.', ',');
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { clienteId, dateFrom, dateTo, situacao } = body;

    let customerName = body.customerName;
    let periodStart = body.periodStart;
    let periodEnd = body.periodEnd;
    let orders = body.orders;
    let summary = body.summary;
    let saldoAnterior = body.saldoAnterior;
    let totalGeral = body.totalGeral;

    // Fonte da verdade: se vier clienteId + período, calcula no servidor.
    if (clienteId && dateFrom && dateTo) {
      const { data } = await getMonthlyReportData({ dateFrom, dateTo, situacao: situacao || 'todos', clienteId });
      let rep: any = data.find((d: any) => d.customer.id === clienteId) || data[0];
      if (!rep) {
        const cust = await prisma.customer.findUnique({ where: { id: clienteId } });
        rep = {
          customer: { id: clienteId, name: cust?.name || '-' },
          orders: [], summary: { totalPedidos: 0, totalPlacas: 0, totalGeral: 0, totalPago: 0, totalAberto: 0 },
          saldoAnterior: 0, totalGeral: 0,
        };
      }
      customerName = rep.customer.name;
      periodStart = formatPeriodDate(dateFrom);
      periodEnd = formatPeriodDate(dateTo);
      orders = rep.orders;
      summary = rep.summary;
      saldoAnterior = rep.saldoAnterior;
      totalGeral = rep.totalGeral;
    }

    const wsData: any[][] = [
      ['CENTRAL.PLACAS — Relatório Mensal'],
      [`Cliente: ${customerName}`],
      [`Período: ${periodStart} a ${periodEnd}`],
      [`Pedidos: ${summary?.totalPedidos ?? 0} | Placas: ${summary?.totalPlacas ?? 0}`],
      [],
    ];

    // For each order, add a block
    for (const order of (orders || [])) {
      const statusLabel = order.remaining <= 0 ? 'PAGO' : order.paidAmount > 0 ? 'PARCIAL' : 'EM ABERTO';
      wsData.push([`Pedido #${order.orderNumber}`, fmtDate(order.createdAt), '', '', '', statusLabel]);
      wsData.push(['Placa', 'Produto', 'Qtd', 'Valor Unitário', '', '']);

      for (const it of (order.items || [])) {
        wsData.push([it.plateNumber || '-', it.product || '-', it.quantity || 1, fmtMoney(it.unitPrice), '', '']);
      }

      if (order.payments && order.payments.length > 0) {
        wsData.push(['Pagamentos:', '', '', '', '', '']);
        for (const p of order.payments) {
          wsData.push([`  ${fmtDate(p.createdAt)}`, paymentMethodLabel(p.paymentMethod), '', `+ R$ ${fmtMoney(p.amount)}`, '', '']);
        }
      }

      wsData.push([`Total: R$ ${fmtMoney(order.totalAmount)}`, `Pago: R$ ${fmtMoney(order.paidAmount)}`, '', `Restante: R$ ${fmtMoney(order.remaining)}`, '', '']);
      wsData.push([]);
    }

    // Summary
    wsData.push([]);
    wsData.push(['RESUMO', '', '', '', '', '']);
    wsData.push(['Total do Período', `R$ ${fmtMoney(summary?.totalGeral ?? 0)}`, '', '', '', '']);
    wsData.push(['Total Pago', `R$ ${fmtMoney(summary?.totalPago ?? 0)}`, '', '', '', '']);
    wsData.push(['Restante (Período)', `R$ ${fmtMoney(summary?.totalAberto ?? 0)}`, '', '', '', '']);

    if (Number(saldoAnterior || 0) > 0) {
      wsData.push(['Saldo Anterior', `R$ ${fmtMoney(saldoAnterior)}`, '', '', '', '']);
      wsData.push(['TOTAL GERAL A PAGAR', `R$ ${fmtMoney(totalGeral)}`, '', '', '', '']);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 8 }, { wch: 18 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio_mensal_${(customerName || '').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[RELATORIO-MENSAL] XLS error:', error);
    return NextResponse.json({ error: 'Erro ao gerar XLS' }, { status: 500 });
  }
}
