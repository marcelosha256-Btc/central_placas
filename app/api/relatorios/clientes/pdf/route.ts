export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

function paymentMethodLabel(m: string) {
  const map: Record<string, string> = {
    'Dinheiro': 'Dinheiro', 'PIX': 'PIX', 'Cartão Crédito': 'Cartão Crédito',
    'Cartão Débito': 'Cartão Débito', 'Transferência': 'Transferência', 'Boleto': 'Boleto',
  };
  return map[m] || m || '-';
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { customerName, periodStart, periodEnd, orders, summary } = await req.json();

    let orderBlocks = '';
    for (const order of (orders || [])) {
      const statusColor = order.remaining <= 0 ? '#16a34a' : order.paidAmount > 0 ? '#d97706' : '#dc2626';
      const statusLabel = order.remaining <= 0 ? 'PAGO' : order.paidAmount > 0 ? 'PARCIAL' : 'EM ABERTO';

      let itemRows = '';
      for (const it of (order.items || [])) {
        itemRows += `<tr>
          <td style="padding:5px 10px;font-size:11px;font-weight:bold;font-family:monospace;font-size:13px;letter-spacing:1px;">${escHtml(it.plateNumber)}</td>
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

      orderBlocks += `
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
    .client-info { margin-bottom: 20px; background: #f0f7ff; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #2B7DB7; }
    .client-info p { margin: 3px 0; font-size: 12px; }
    .client-info b { color: #1E3A5F; }
    .total-box { margin-top: 10px; background: #1E3A5F; color: white; border-radius: 8px; padding: 15px 20px; }
    .total-box .row { display: flex; justify-content: space-between; align-items: center; margin: 4px 0; }
    .total-box .row.highlight { font-size: 18px; font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); }
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Relatório de Clientes — ${periodStart} a ${periodEnd}</p>
  </div>

  <div class="client-info">
    <p><b>Cliente:</b> ${escHtml(customerName)}</p>
    <p><b>Pedidos:</b> ${summary?.totalPedidos ?? 0} | <b>Placas:</b> ${summary?.totalPlacas ?? 0}</p>
  </div>

  ${orderBlocks || '<p style="text-align:center;color:#999;padding:30px;">Nenhum pedido encontrado no período.</p>'}

  <div class="total-box">
    <div class="row"><span>Total Geral</span><span style="font-family:monospace;">${fmtMoney(summary?.totalGeral)}</span></div>
    <div class="row"><span>Total Pago</span><span style="font-family:monospace;color:#4ade80;">${fmtMoney(summary?.totalPago)}</span></div>
    <div class="row highlight"><span>RESTANTE A PAGAR</span><span style="font-family:monospace;color:${(summary?.totalAberto ?? 0) > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(summary?.totalAberto)}</span></div>
  </div>

  <div class="footer"><p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
</body>
</html>`;

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
            'Content-Disposition': `attachment; filename="relatorio_cliente_${(customerName || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          },
        });
      } else if (statusResult?.status === 'FAILED') {
        return NextResponse.json({ error: 'Falha ao gerar PDF' }, { status: 500 });
      }
      attempts++;
    }
    return NextResponse.json({ error: 'Timeout ao gerar PDF' }, { status: 500 });
  } catch (error) {
    console.error('[RELATORIO-CLIENTES] PDF error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
