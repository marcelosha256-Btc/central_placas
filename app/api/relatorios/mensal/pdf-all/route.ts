export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMonthlyReportData, formatPeriodDate } from '@/lib/monthly-report';

function fmtMoney(v: number) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function escHtml(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDoc(doc: string): string {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return doc;
}

function paymentMethodLabel(m: string) {
  const map: Record<string, string> = {
    'Dinheiro': 'Dinheiro', 'PIX': 'PIX', 'Cartão Crédito': 'Cartão Crédito',
    'Cartão Débito': 'Cartão Débito', 'Transferência': 'Transferência', 'Boleto': 'Boleto',
    'A_PRAZO': 'A Prazo',
  };
  return map[m] || m || '-';
}

function buildOrderBlocks(orders: any[]) {
  let html = '';
  for (const order of (orders || [])) {
    const statusColor = order.remaining <= 0 ? '#16a34a' : order.paidAmount > 0 ? '#d97706' : '#dc2626';
    const statusLabel = order.remaining <= 0 ? 'PAGO' : order.paidAmount > 0 ? 'PARCIAL' : 'EM ABERTO';

    let itemRows = '';
    for (const it of (order.items || [])) {
      itemRows += `<tr>
        <td style="padding:5px 10px;font-weight:bold;font-family:monospace;font-size:13px;letter-spacing:1px;">${escHtml(it.plateNumber)}</td>
        <td style="padding:5px 10px;font-size:11px;">${escHtml(it.product)}</td>
        <td style="padding:5px 10px;font-size:11px;text-align:center;">${it.quantity || 1}</td>
        <td style="padding:5px 10px;font-size:11px;text-align:right;font-family:monospace;">${fmtMoney(it.unitPrice)}</td>
      </tr>`;
    }

    let paymentRows = '';
    if (order.payments && order.payments.length > 0) {
      for (const p of order.payments) {
        paymentRows += `<tr>
          <td style="padding:4px 10px;font-size:11px;">${fmtDate(p.createdAt)}</td>
          <td style="padding:4px 10px;font-size:11px;">${escHtml(paymentMethodLabel(p.paymentMethod))}</td>
          <td style="padding:4px 10px;font-size:11px;text-align:right;font-family:monospace;color:#16a34a;font-weight:bold;">+ ${fmtMoney(p.amount)}</td>
        </tr>`;
      }
    }

    html += `
    <div style="margin-bottom:16px;border:1px solid #d0d5dd;border-radius:8px;overflow:hidden;">
      <div style="background:#1E3A5F;color:white;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:13px;font-weight:bold;">Pedido #${order.orderNumber}</span>
          <span style="font-size:11px;margin-left:12px;opacity:0.8;">${fmtDate(order.createdAt)}</span>
        </div>
        <span style="font-size:11px;background:${statusColor};padding:2px 10px;border-radius:10px;font-weight:bold;">${statusLabel}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:5px 10px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;">Placa</th>
            <th style="padding:5px 10px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;">Produto</th>
            <th style="padding:5px 10px;text-align:center;font-size:10px;color:#64748b;text-transform:uppercase;">Qtd</th>
            <th style="padding:5px 10px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;">Valor</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${order.payments && order.payments.length > 0 ? `
      <div style="border-top:1px dashed #d0d5dd;padding:6px 12px 2px;background:#f9fafb;">
        <p style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:2px;">Pagamentos Realizados</p>
        <p style="font-size:10px;color:#1E3A5F;margin-bottom:4px;">Placas: <b style="font-family:monospace;letter-spacing:1px;">${(order.items || []).map((it: any) => escHtml(it.plateNumber)).filter((p: string) => p && p !== '-').join(', ') || '-'}</b></p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${paymentRows}</tbody>
        </table>
      </div>` : ''}
      <div style="border-top:1px solid #d0d5dd;padding:8px 12px;background:#f0f4f8;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;">
          <span style="color:#64748b;">Total:</span> <b>${fmtMoney(order.totalAmount)}</b>
          <span style="margin-left:15px;color:#64748b;">Pago:</span> <b style="color:#16a34a;">${fmtMoney(order.paidAmount)}</b>
        </div>
        <div style="font-size:13px;font-weight:bold;color:${order.remaining > 0 ? '#dc2626' : '#16a34a'};">
          ${order.remaining > 0 ? `Restante: ${fmtMoney(order.remaining)}` : '✓ Quitado'}
        </div>
      </div>
    </div>`;
  }
  return html;
}

function buildResumidoClientPage(c: any) {
  const orders = c.orders || [];
  const summary = c.summary || {};
  const saldoAnt = Number(c.saldoAnterior || 0);
  const totalGeralPedidos = summary.totalGeral ?? c.totalGeralPedidos ?? 0;
  const totalPago = summary.totalPago ?? c.totalPago ?? 0;
  const totalAberto = summary.totalAberto ?? c.totalAberto ?? 0;
  const totalGeralVal = Number(c.totalGeral || 0);

  let plateRows = '';
  let subtotal = 0;
  let plateCount = 0;
  for (const order of orders) {
    for (const it of (order.items || [])) {
      subtotal += Number(it.unitPrice || 0) * (it.quantity || 1);
      plateCount += it.quantity || 1;
      plateRows += `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;">${fmtDate(order.createdAt)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;text-align:center;">#${order.orderNumber}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-family:monospace;font-size:12px;font-weight:bold;letter-spacing:1px;color:#1E3A5F;">${escHtml(it.plateNumber)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;">${escHtml(it.product)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;text-align:right;font-family:monospace;white-space:nowrap;">${fmtMoney(it.unitPrice)}</td>
      </tr>`;
    }
  }

  return `
  <div class="client-page" style="page-break-after:always;">
    <div class="client-info">
      <p><b>Cliente:</b> ${escHtml(c.customer?.name || '-')}</p>
      ${c.customer?.document ? `<p><b>CPF/CNPJ:</b> ${escHtml(fmtDoc(c.customer.document))}</p>` : ''}
      <p><b>Pedidos:</b> ${summary.totalPedidos ?? c.pedidos ?? 0} | <b>Placas:</b> ${summary.totalPlacas ?? (c.placas?.length || 0)}</p>
    </div>

    <div style="font-size:12px;font-weight:bold;color:#1E3A5F;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #2B7DB7;">📋 Placas do Período</div>

    ${plateRows ? `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="background:#1E3A5F;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;width:70px;">Data</th>
          <th style="background:#1E3A5F;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;width:60px;">Pedido</th>
          <th style="background:#1E3A5F;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;">Placa</th>
          <th style="background:#1E3A5F;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;">Produto</th>
          <th style="background:#1E3A5F;color:white;padding:6px 8px;text-align:right;font-size:10px;text-transform:uppercase;width:80px;">Valor</th>
        </tr>
      </thead>
      <tbody>${plateRows}</tbody>
      <tfoot>
        <tr style="background:#f0f4f8;border-top:2px solid #1E3A5F;">
          <td colspan="4" style="padding:6px 8px;font-weight:bold;text-align:right;">SUBTOTAL (${plateCount} placas)</td>
          <td style="padding:6px 8px;font-weight:bold;text-align:right;font-family:monospace;white-space:nowrap;">${fmtMoney(subtotal)}</td>
        </tr>
      </tfoot>
    </table>` : '<p style="text-align:center;color:#999;padding:20px;">Nenhum pedido encontrado.</p>'}

    <div style="margin-top:16px;background:#1E3A5F;color:white;border-radius:8px;padding:14px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:13px;"><span>Total do Período</span><span style="font-family:monospace;">${fmtMoney(totalGeralPedidos)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:13px;"><span>Total Pago</span><span style="font-family:monospace;color:#4ade80;">${fmtMoney(totalPago)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:bold;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.3);"><span>RESTANTE (PERÍODO)</span><span style="font-family:monospace;color:${totalAberto > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(totalAberto)}</span></div>
    </div>

    ${saldoAnt > 0 ? `
    <div style="margin-top:8px;background:#fff8e1;border:1px solid #f9a825;border-radius:8px;padding:10px 15px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:12px;"><span>⚠️ <b>Saldo Anterior</b></span><span style="font-family:monospace;font-weight:bold;color:#b8860b;">${fmtMoney(saldoAnt)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:12px;"><span>Restante do período</span><span style="font-family:monospace;">${fmtMoney(totalAberto)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:bold;margin-top:6px;padding-top:6px;border-top:1px solid #f9a825;color:#c62828;"><span>TOTAL GERAL A PAGAR</span><span style="font-family:monospace;">${fmtMoney(totalGeralVal)}</span></div>
    </div>` : ''}
  </div>`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    let { clients, periodStart, periodEnd } = body;
    const { dateFrom, dateTo, situacao, apenasEnvioMensal } = body;

    // Fonte da verdade: se vier o período, calcula todos os clientes no servidor.
    if (dateFrom && dateTo) {
      const { data } = await getMonthlyReportData({ dateFrom, dateTo, situacao: situacao || 'todos', apenasEnvioMensal: !!apenasEnvioMensal });
      clients = data;
      periodStart = formatPeriodDate(dateFrom);
      periodEnd = formatPeriodDate(dateTo);
    }

    if (!clients || !clients.length) {
      return NextResponse.json({ error: 'Nenhum cliente para exportar' }, { status: 400 });
    }

    // Build one page per client - use each client's reportType
    const clientPages = (clients as any[]).map((c: any) => {
      const clientFormat = c.customer?.reportType || 'detalhado';
      if (clientFormat === 'resumido') {
        return buildResumidoClientPage(c);
      }

      const orderBlocks = buildOrderBlocks(c.orders || []);
      const saldoAnt = Number(c.saldoAnterior || 0);
      const totalAberto = c.summary?.totalAberto ?? c.totalAberto ?? 0;
      const totalPago = c.summary?.totalPago ?? c.totalPago ?? 0;
      const totalGeralPedidos = c.summary?.totalGeral ?? c.totalGeralPedidos ?? 0;
      const totalGeralVal = Number(c.totalGeral || 0);

      return `
      <div class="client-page" style="page-break-after:always;">
        <div class="client-info">
          <p><b>Cliente:</b> ${escHtml(c.customer?.name || '-')}</p>
          ${c.customer?.document ? `<p><b>CPF/CNPJ:</b> ${escHtml(fmtDoc(c.customer.document))}</p>` : ''}
          <p><b>Pedidos:</b> ${c.summary?.totalPedidos ?? c.pedidos ?? 0} | <b>Placas:</b> ${c.summary?.totalPlacas ?? (c.placas?.length || 0)}</p>
        </div>

        ${orderBlocks || '<p style="text-align:center;color:#999;padding:20px;">Nenhum pedido encontrado.</p>'}

        <div class="total-box">
          <div class="row"><span>Total do Período</span><span style="font-family:monospace;">${fmtMoney(totalGeralPedidos)}</span></div>
          <div class="row"><span>Total Pago</span><span style="font-family:monospace;color:#4ade80;">${fmtMoney(totalPago)}</span></div>
          <div class="row highlight"><span>RESTANTE (PERÍODO)</span><span style="font-family:monospace;color:${totalAberto > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(totalAberto)}</span></div>
        </div>

        ${saldoAnt > 0 ? `
        <div class="saldo-box">
          <div class="saldo-row"><span>⚠️ <b>Saldo Anterior</b></span><span style="font-family:monospace;font-weight:bold;color:#b8860b;">${fmtMoney(saldoAnt)}</span></div>
          <div class="saldo-row"><span>Restante do período</span><span style="font-family:monospace;">${fmtMoney(totalAberto)}</span></div>
          <div class="saldo-row" style="font-size:16px;font-weight:bold;margin-top:6px;padding-top:6px;border-top:1px solid #f9a825;color:#c62828;"><span>TOTAL GERAL A PAGAR</span><span style="font-family:monospace;">${fmtMoney(totalGeralVal)}</span></div>
        </div>` : ''}
      </div>`;
    }).join('');

    // Summary page
    const totalClientes = clients.length;
    const totalPlacas = clients.reduce((a: number, c: any) => a + (c.summary?.totalPlacas ?? c.placas?.length ?? 0), 0);
    const totalAberto = clients.reduce((a: number, c: any) => a + Number(c.totalAberto || 0), 0);
    const totalSaldoAnt = clients.reduce((a: number, c: any) => a + Number(c.saldoAnterior || 0), 0);
    const totalGeral = clients.reduce((a: number, c: any) => a + Number(c.totalGeral || 0), 0);

    const summaryPage = `
    <div class="client-page" style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
      <div style="text-align:center;background:#f0f7ff;padding:30px 40px;max-width:500px;width:100%;border-radius:12px;border:1px solid #d0d5dd;">
        <h2 style="color:#1E3A5F;margin-bottom:20px;font-size:20px;border-bottom:2px solid #1E3A5F;padding-bottom:10px;">RESUMO GERAL</h2>
        <p style="font-size:14px;margin:8px 0;"><b>Total de Clientes:</b> ${totalClientes}</p>
        <p style="font-size:14px;margin:8px 0;"><b>Total de Placas:</b> ${totalPlacas}</p>
        <p style="font-size:14px;margin:8px 0;"><b>Total em Aberto (Período):</b> <span style="color:#c62828;font-weight:bold;">${fmtMoney(totalAberto)}</span></p>
        ${totalSaldoAnt > 0 ? `<p style="font-size:14px;margin:8px 0;"><b>Saldo Anterior Total:</b> <span style="color:#b8860b;font-weight:bold;">${fmtMoney(totalSaldoAnt)}</span></p>` : ''}
        <div style="margin-top:20px;padding:15px;background:#1E3A5F;border-radius:8px;color:white;">
          <p style="font-size:18px;"><b>TOTAL GERAL:</b> <span style="font-family:monospace;font-size:22px;">${fmtMoney(totalGeral)}</span></p>
        </div>
      </div>
    </div>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #1E3A5F; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1E3A5F; padding-bottom: 12px; }
    .header h1 { font-size: 22px; color: #1E3A5F; }
    .header h1 span { color: #2B7DB7; }
    .header p { color: #666; font-size: 11px; margin-top: 4px; }
    .client-info { margin-bottom: 16px; background: #f0f7ff; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #2B7DB7; }
    .client-info p { margin: 3px 0; font-size: 12px; }
    .client-info b { color: #1E3A5F; }
    .total-box { margin-top: 10px; background: #1E3A5F; color: white; border-radius: 8px; padding: 12px 16px; }
    .total-box .row { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 12px; }
    .total-box .row.highlight { font-size: 16px; font-weight: bold; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.3); }
    .saldo-box { margin-top: 8px; background: #fff8e1; border: 1px solid #f9a825; border-radius: 8px; padding: 10px 15px; }
    .saldo-box .saldo-row { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 12px; }
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
    .client-page { margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Relatório Mensal Consolidado — Período: ${escHtml(periodStart)} a ${escHtml(periodEnd)}</p>
  </div>
  ${clientPages}
  ${summaryPage}
  <div class="footer"><p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[RELATORIO-MENSAL] PDF-ALL error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF consolidado' }, { status: 500 });
  }
}
