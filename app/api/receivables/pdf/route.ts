export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function fmtCur(v: number) {
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
  };
  return map[m] || m || '-';
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { clients, dateFrom, dateTo, totalRestante } = await req.json();

    let clientBlocks = '';
    for (const c of (clients || [])) {
      let orderBlocks = '';
      for (const order of (c.orders || [])) {
        const statusColor = order.remaining <= 0.01 ? '#16a34a' : order.paidAmount > 0 ? '#d97706' : '#dc2626';
        const statusLabel = order.remaining <= 0.01 ? 'PAGO' : order.paidAmount > 0 ? 'PARCIAL' : 'EM ABERTO';

        let itemRows = '';
        for (const it of (order.items || [])) {
          itemRows += `<tr>
            <td style="padding:4px 10px;font-size:11px;font-weight:bold;font-family:monospace;font-size:12px;letter-spacing:1px;">${escHtml(it.plateNumber || '-')}</td>
            <td style="padding:4px 10px;font-size:11px;">${escHtml(it.product || '-')}</td>
            <td style="padding:4px 10px;font-size:11px;text-align:center;">${it.quantity || 1}</td>
            <td style="padding:4px 10px;font-size:11px;text-align:right;font-family:monospace;">${fmtCur(it.unitPrice)}</td>
          </tr>`;
        }

        let paymentRows = '';
        if (order.payments && order.payments.length > 0) {
          for (const p of order.payments) {
            paymentRows += `<tr>
              <td style="padding:3px 10px;font-size:10px;">${fmtDate(p.createdAt)}</td>
              <td style="padding:3px 10px;font-size:10px;">${escHtml(paymentMethodLabel(p.paymentMethod))}</td>
              <td style="padding:3px 10px;font-size:10px;text-align:right;font-family:monospace;color:#16a34a;font-weight:bold;">+ ${fmtCur(p.amount)}</td>
            </tr>`;
          }
        }

        orderBlocks += `
        <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
          <div style="background:#e8f0fe;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d0d5dd;">
            <div>
              <span style="font-size:12px;font-weight:bold;color:#1E3A5F;">Pedido #${order.orderNumber}</span>
              <span style="font-size:10px;margin-left:10px;color:#64748b;">${fmtDate(order.createdAt)}</span>
            </div>
            <span style="font-size:10px;color:white;background:${statusColor};padding:2px 8px;border-radius:8px;font-weight:bold;">${statusLabel}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:4px 10px;text-align:left;font-size:9px;color:#94a3b8;text-transform:uppercase;">Placa</th>
              <th style="padding:4px 10px;text-align:left;font-size:9px;color:#94a3b8;text-transform:uppercase;">Produto</th>
              <th style="padding:4px 10px;text-align:center;font-size:9px;color:#94a3b8;text-transform:uppercase;">Qtd</th>
              <th style="padding:4px 10px;text-align:right;font-size:9px;color:#94a3b8;text-transform:uppercase;">Valor</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          ${order.payments && order.payments.length > 0 ? `
          <div style="border-top:1px dashed #d0d5dd;padding:5px 10px 2px;background:#f9fafb;">
            <p style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:2px;">Pagamentos Realizados</p>
            <p style="font-size:9px;color:#1E3A5F;margin-bottom:3px;">Placas: <b style="font-family:monospace;letter-spacing:1px;">${(order.items || []).map((it: any) => escHtml(it.plateNumber)).filter((p: string) => p && p !== '-').join(', ') || '-'}</b></p>
            <table style="width:100%;border-collapse:collapse;"><tbody>${paymentRows}</tbody></table>
          </div>` : ''}
          <div style="border-top:1px solid #e2e8f0;padding:6px 10px;background:#f0f4f8;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:10px;"><span style="color:#64748b;">Total:</span> <b>${fmtCur(order.totalAmount)}</b> <span style="margin-left:10px;color:#64748b;">Pago:</span> <b style="color:#16a34a;">${fmtCur(order.paidAmount)}</b></div>
            <div style="font-size:12px;font-weight:bold;color:${order.remaining > 0.01 ? '#dc2626' : '#16a34a'};">
              ${order.remaining > 0.01 ? `Restante: ${fmtCur(order.remaining)}` : '✓ Quitado'}
            </div>
          </div>
        </div>`;
      }

      clientBlocks += `
      <div style="margin-bottom:25px;page-break-inside:avoid;">
        <div style="background:#1E3A5F;color:white;padding:10px 15px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:14px;font-weight:bold;">${escHtml(c.customerName)}</span>
            ${c.customerDocument ? `<span style="font-size:11px;opacity:0.75;margin-left:10px;">CPF/CNPJ: ${escHtml(fmtDoc(c.customerDocument))}</span>` : ''}
          </div>
          <span style="font-size:11px;opacity:0.85;">${c.orderCount} pedido(s)</span>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-top:none;padding:8px 15px;border-radius:0 0 8px 8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:11px;">
            <span style="color:#64748b;">Total:</span> <b>${fmtCur(c.totalAmount)}</b>
            <span style="margin-left:12px;color:#64748b;">Pago:</span> <b style="color:#16a34a;">${fmtCur(c.paidAmount)}</b>
          </div>
          <div style="font-size:14px;font-weight:bold;color:#dc2626;">Deve: ${fmtCur(c.remaining)}</div>
        </div>
        ${orderBlocks}
      </div>`;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 25px; color: #1E3A5F; font-size: 12px; }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1E3A5F; padding-bottom: 12px; }
    .header h1 { font-size: 22px; color: #1E3A5F; }
    .header h1 span { color: #2B7DB7; }
    .header p { color: #666; font-size: 11px; margin-top: 4px; }
    .summary { margin-bottom: 20px; background: #1E3A5F; color: white; padding: 12px 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .summary .label { font-size: 11px; opacity: 0.8; }
    .summary .value { font-size: 18px; font-weight: bold; font-family: monospace; }
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Contas a Receber — Período: ${dateFrom || '-'} a ${dateTo || '-'}</p>
  </div>

  <div class="summary">
    <div>
      <div class="label">Clientes com saldo pendente</div>
      <div style="font-size:16px;font-weight:bold;">${(clients || []).length}</div>
    </div>
    <div style="text-align:right;">
      <div class="label">TOTAL A RECEBER</div>
      <div class="value" style="color:#fca5a5;">${fmtCur(totalRestante)}</div>
    </div>
  </div>

  ${clientBlocks || '<p style="text-align:center;color:#999;padding:40px;">Nenhum registro encontrado.</p>'}

  <div class="footer">
    <p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
  </div>
</body>
</html>`;

    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: { format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }, print_background: true },
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
            'Content-Disposition': `attachment; filename="contas_receber_${dateFrom}_${dateTo}.pdf"`,
          },
        });
      } else if (statusResult?.status === 'FAILED') {
        return NextResponse.json({ error: 'Falha ao gerar PDF' }, { status: 500 });
      }
      attempts++;
    }
    return NextResponse.json({ error: 'Timeout ao gerar PDF' }, { status: 500 });
  } catch (error) {
    console.error('[RECEIVABLES] PDF error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
