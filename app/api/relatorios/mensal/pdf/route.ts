export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
    <div style="margin-bottom:20px;border:1px solid #d0d5dd;border-radius:8px;overflow:hidden;">
      <!-- Pedido Header -->
      <div style="background:#1E3A5F;color:white;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:13px;font-weight:bold;">Pedido #${order.orderNumber}</span>
          <span style="font-size:11px;margin-left:12px;opacity:0.8;">${fmtDate(order.createdAt)}</span>
        </div>
        <span style="font-size:11px;background:${statusColor};padding:2px 10px;border-radius:10px;font-weight:bold;">${statusLabel}</span>
      </div>

      <!-- Placas -->
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
      <!-- Pagamentos -->
      <div style="border-top:1px dashed #d0d5dd;padding:6px 12px 2px;background:#f9fafb;">
        <p style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:2px;">Pagamentos Realizados</p>
        <p style="font-size:10px;color:#1E3A5F;margin-bottom:4px;">Placas: <b style="font-family:monospace;letter-spacing:1px;">${(order.items || []).map((it: any) => escHtml(it.plateNumber)).filter((p: string) => p && p !== '-').join(', ') || '-'}</b></p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${paymentRows}</tbody>
        </table>
      </div>` : ''}

      <!-- Totais do pedido -->
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

function buildResumidoHtml(params: { customerName: string; customerDocument?: string; periodStart: string; periodEnd: string; orders: any[]; summary: any; saldoAnterior: number; totalGeral: number }) {
  const { customerName, customerDocument, periodStart, periodEnd, orders, summary, saldoAnterior, totalGeral } = params;
  const saldoAnt = Number(saldoAnterior || 0);
  const totalGeralPedidos = summary?.totalGeral ?? 0;
  const totalPago = summary?.totalPago ?? 0;
  const totalAberto = summary?.totalAberto ?? 0;

  // Build flat plate rows from all orders
  let plateRows = '';
  let subtotal = 0;
  let plateCount = 0;
  for (const order of (orders || [])) {
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

  return `<!DOCTYPE html>
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
    .client-info { margin-bottom: 20px; background: #f0f7ff; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #2B7DB7; }
    .client-info p { margin: 3px 0; font-size: 12px; }
    .client-info b { color: #1E3A5F; }
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Relatório Mensal — Período: ${escHtml(periodStart)} a ${escHtml(periodEnd)}</p>
  </div>

  <div class="client-info">
    <p><b>Cliente:</b> ${escHtml(customerName)}</p>
    ${customerDocument ? `<p><b>CPF/CNPJ:</b> ${escHtml(fmtDoc(customerDocument))}</p>` : ''}
    <p><b>Pedidos:</b> ${summary?.totalPedidos ?? 0} | <b>Placas:</b> ${summary?.totalPlacas ?? 0}</p>
  </div>

  <div style="font-size:12px;font-weight:bold;color:#1E3A5F;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #2B7DB7;display:flex;align-items:center;gap:6px;">
    <span style="width:18px;height:18px;background:#2B7DB7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">📋</span> Placas do Período
  </div>

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
  </table>` : '<p style="text-align:center;color:#999;padding:30px;">Nenhum pedido encontrado no período.</p>'}

  <div style="margin-top:20px;background:#1E3A5F;color:white;border-radius:8px;padding:16px 24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:14px;"><span>Total do Período</span><span style="font-family:monospace;">${fmtMoney(totalGeralPedidos)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:14px;"><span>Total Pago</span><span style="font-family:monospace;color:#4ade80;">${fmtMoney(totalPago)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:20px;font-weight:bold;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.3);"><span>RESTANTE (PERÍODO)</span><span style="font-family:monospace;color:${totalAberto > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(totalAberto)}</span></div>
  </div>

  ${saldoAnt > 0 ? `
  <div style="margin-top:10px;background:#fff8e1;border:1px solid #f9a825;border-radius:8px;padding:12px 15px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:12px;"><span>⚠️ <b>Saldo Anterior</b> (períodos anteriores)</span><span style="font-family:monospace;font-weight:bold;color:#b8860b;">${fmtMoney(saldoAnt)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:3px 0;font-size:12px;"><span>Restante do período atual</span><span style="font-family:monospace;">${fmtMoney(totalAberto)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:bold;margin-top:6px;padding-top:6px;border-top:1px solid #f9a825;color:#c62828;"><span>TOTAL GERAL A PAGAR</span><span style="font-family:monospace;">${fmtMoney(Number(totalGeral || 0))}</span></div>
  </div>` : ''}

  <div class="footer"><p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { clienteId, dateFrom, dateTo, situacao, format } = body;

    let customerName = body.customerName;
    let customerDocument: string = body.customerDocument ?? '';
    let periodStart = body.periodStart;
    let periodEnd = body.periodEnd;
    let orders = body.orders;
    let summary = body.summary;
    let saldoAnterior = body.saldoAnterior;
    let totalGeral = body.totalGeral;
    let reportFormat = format === 'resumido' ? 'resumido' : 'detalhado';

    // Fonte da verdade: se vierem identificadores (clienteId + período), os dados
    // são CALCULADOS no servidor — não dependem do que o navegador mandou. Isso
    // garante números consistentes e permite gerar o PDF de forma automática.
    if (clienteId && dateFrom && dateTo) {
      const { data } = await getMonthlyReportData({ dateFrom, dateTo, situacao: situacao || 'todos', clienteId });
      let rep: any = data.find((d: any) => d.customer.id === clienteId) || data[0];
      if (!rep) {
        const cust = await prisma.customer.findUnique({ where: { id: clienteId } });
        rep = {
          customer: { id: clienteId, name: cust?.name || '-', reportType: cust?.reportType },
          orders: [], summary: { totalPedidos: 0, totalPlacas: 0, totalGeral: 0, totalPago: 0, totalAberto: 0 },
          saldoAnterior: 0, totalGeral: 0,
        };
      }
      customerName = rep.customer.name;
      customerDocument = rep.customer.document ?? '';
      periodStart = formatPeriodDate(dateFrom);
      periodEnd = formatPeriodDate(dateTo);
      orders = rep.orders;
      summary = rep.summary;
      saldoAnterior = rep.saldoAnterior;
      totalGeral = rep.totalGeral;
      if (!format) reportFormat = rep.customer.reportType === 'resumido' ? 'resumido' : 'detalhado';
    }

    let htmlContent: string;

    if (reportFormat === 'resumido') {
      htmlContent = buildResumidoHtml({ customerName, customerDocument, periodStart, periodEnd, orders, summary, saldoAnterior, totalGeral });
    } else {

    const orderBlocks = buildOrderBlocks(orders || []);
    const saldoAnt = Number(saldoAnterior || 0);
    const totalGeralVal = Number(totalGeral || 0);
    const totalAberto = summary?.totalAberto ?? 0;
    const totalPago = summary?.totalPago ?? 0;
    const totalGeralPedidos = summary?.totalGeral ?? 0;

    htmlContent = `<!DOCTYPE html>
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
    .client-info { margin-bottom: 20px; background: #f0f7ff; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #2B7DB7; }
    .client-info p { margin: 3px 0; font-size: 12px; }
    .client-info b { color: #1E3A5F; }
    .total-box { margin-top: 10px; background: #1E3A5F; color: white; border-radius: 8px; padding: 15px 20px; }
    .total-box .row { display: flex; justify-content: space-between; align-items: center; margin: 4px 0; }
    .total-box .row.highlight { font-size: 18px; font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); }
    .saldo-box { margin-top: 10px; background: #fff8e1; border: 1px solid #f9a825; border-radius: 8px; padding: 12px 15px; }
    .saldo-box .row { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 12px; }
    .saldo-box .row.total { font-size: 16px; font-weight: bold; margin-top: 6px; padding-top: 6px; border-top: 1px solid #f9a825; color: #c62828; }
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Relatório Mensal — Período: ${escHtml(periodStart)} a ${escHtml(periodEnd)}</p>
  </div>

  <div class="client-info">
    <p><b>Cliente:</b> ${escHtml(customerName)}</p>
    ${customerDocument ? `<p><b>CPF/CNPJ:</b> ${escHtml(fmtDoc(customerDocument))}</p>` : ''}
    <p><b>Pedidos:</b> ${summary?.totalPedidos ?? 0} | <b>Placas:</b> ${summary?.totalPlacas ?? 0}</p>
  </div>

  ${orderBlocks || '<p style="text-align:center;color:#999;padding:30px;">Nenhum pedido encontrado no período.</p>'}

  <div class="total-box">
    <div class="row"><span>Total do Período</span><span style="font-family:monospace;">${fmtMoney(totalGeralPedidos)}</span></div>
    <div class="row"><span>Total Pago</span><span style="font-family:monospace;color:#4ade80;">${fmtMoney(totalPago)}</span></div>
    <div class="row highlight"><span>RESTANTE (PERÍODO)</span><span style="font-family:monospace;color:${totalAberto > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(totalAberto)}</span></div>
  </div>

  ${saldoAnt > 0 ? `
  <div class="saldo-box">
    <div class="row"><span>⚠️ <b>Saldo Anterior</b> (períodos anteriores)</span><span style="font-family:monospace;font-weight:bold;color:#b8860b;">${fmtMoney(saldoAnt)}</span></div>
    <div class="row"><span>Restante do período atual</span><span style="font-family:monospace;">${fmtMoney(totalAberto)}</span></div>
    <div class="row total"><span>TOTAL GERAL A PAGAR</span><span style="font-family:monospace;">${fmtMoney(totalGeralVal)}</span></div>
  </div>` : ''}

  <div class="footer"><p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
</body>
</html>`;

    } // end detalhado

    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: { format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }, print_background: true },
      }),
    });

    if (!createResponse.ok) return NextResponse.json({ error: 'Erro ao criar requisição de PDF' }, { status: 500 });
    const { request_id } = await createResponse.json();
    if (!request_id) return NextResponse.json({ error: 'Nenhum request_id retornado' }, { status: 500 });

    let attempts = 0;
    while (attempts < 120) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusResponse.json();
      if (statusResult?.status === 'SUCCESS' && statusResult?.result?.result) {
        const pdfBuffer = Buffer.from(statusResult.result.result, 'base64');
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="relatorio_mensal_${(customerName || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          },
        });
      } else if (statusResult?.status === 'FAILED') {
        return NextResponse.json({ error: 'Falha ao gerar PDF' }, { status: 500 });
      }
      attempts++;
    }
    return NextResponse.json({ error: 'Timeout ao gerar PDF' }, { status: 500 });
  } catch (error) {
    console.error('[RELATORIO-MENSAL] PDF error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
