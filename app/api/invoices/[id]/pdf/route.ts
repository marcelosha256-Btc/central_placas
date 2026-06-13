export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeInvoiceReceived } from '@/lib/invoice-calc';

function fmtMoney(v: number) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function fmtDate(d: string | Date) {
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true, document: true, paymentTerm: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { invoiceId: invoice.id },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const { amountReceived } = await computeInvoiceReceived(invoice);

    const paymentTermLabel: Record<string, string> = { AVISTA: 'À Vista', D15: 'D+15', D30: 'D+30' };

    // Build plate rows
    let plateRows = '';
    let plateCount = 0;
    for (const order of orders) {
      for (const it of (order.items || [])) {
        plateCount += (it as any).quantity || 1;
        plateRows += `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;">${fmtDate(order.createdAt)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;text-align:center;">#${order.orderNumber}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-family:monospace;font-size:12px;font-weight:bold;letter-spacing:1px;color:#1E3A5F;">${escHtml((it as any).plateNumber || '-')}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;">${escHtml((it as any).product?.description || (it as any).description || '')}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8ecf0;font-size:11px;text-align:right;font-family:monospace;white-space:nowrap;">${fmtMoney((it as any).unitPrice)}</td>
        </tr>`;
      }
    }

    const periodLabel = `${fmtDate(invoice.periodStart)} a ${fmtDate(invoice.periodEnd)}`;
    const now = new Date();
    let derivedStatus = invoice.status;
    if (invoice.status !== 'CANCELADA' && invoice.status !== 'PAGA') {
      if (amountReceived >= invoice.amountDue && invoice.amountDue > 0) derivedStatus = 'PAGA';
      else if (amountReceived > 0 && amountReceived < invoice.amountDue) derivedStatus = 'PARCIAL';
      else if (invoice.dueDate && new Date(invoice.dueDate) < now) derivedStatus = 'VENCIDA';
    }
    const statusLabel: Record<string, string> = { GERADA: 'Gerada', ENVIADA: 'Enviada', PARCIAL: 'Parcial', PAGA: 'Paga', VENCIDA: 'Vencida', CANCELADA: 'Cancelada' };
    const statusColor: Record<string, string> = { GERADA: '#6b7280', ENVIADA: '#2563eb', PARCIAL: '#d97706', PAGA: '#16a34a', VENCIDA: '#dc2626', CANCELADA: '#9ca3af' };

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
    .footer { margin-top: 25px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>FATURA Nº ${escHtml(invoice.number)} — Período: ${escHtml(periodLabel)}</p>
  </div>

  <div style="margin-bottom:20px;background:#f0f7ff;padding:12px 15px;border-radius:8px;border-left:4px solid #2B7DB7;">
    <p style="margin:3px 0;font-size:12px;"><b>Cliente:</b> ${escHtml(invoice.customer?.name || '')}</p>
    ${invoice.customer?.document ? `<p style="margin:3px 0;font-size:12px;"><b>CPF/CNPJ:</b> ${escHtml(fmtDoc(invoice.customer.document))}</p>` : ''}
    <div style="display:flex;gap:30px;margin-top:6px;">
      <p style="font-size:12px;"><b>Prazo:</b> ${paymentTermLabel[(invoice.customer as any)?.paymentTerm] || 'À Vista'}</p>
      <p style="font-size:12px;"><b>Vencimento:</b> ${fmtDate(invoice.dueDate)}</p>
      <p style="font-size:12px;"><b>Status:</b> <span style="color:${statusColor[derivedStatus] || '#6b7280'};font-weight:bold;">${statusLabel[derivedStatus] || derivedStatus}</span></p>
    </div>
    <p style="margin:3px 0;font-size:12px;"><b>Pedidos:</b> ${invoice.orderCount} | <b>Placas:</b> ${plateCount}</p>
  </div>

  ${plateRows ? `
  <div style="font-size:12px;font-weight:bold;color:#1E3A5F;margin:15px 0 8px;padding-bottom:4px;border-bottom:2px solid #2B7DB7;">📋 Placas do Período</div>
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
        <td style="padding:6px 8px;font-weight:bold;text-align:right;font-family:monospace;white-space:nowrap;">${fmtMoney(invoice.servicesTotal)}</td>
      </tr>
    </tfoot>
  </table>` : '<p style="text-align:center;color:#999;padding:30px;">Nenhum pedido vinculado.</p>'}

  <div style="margin-top:20px;background:#1E3A5F;color:white;border-radius:8px;padding:18px 24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;"><span>Serviços do Período</span><span style="font-family:monospace;">${fmtMoney(invoice.servicesTotal)}</span></div>
    ${invoice.previousBalance > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;"><span>⚠️ Saldo Anterior</span><span style="font-family:monospace;color:#fcd34d;">${fmtMoney(invoice.previousBalance)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.3);font-size:18px;font-weight:bold;"><span>TOTAL DA FATURA</span><span style="font-family:monospace;color:${invoice.amountDue > 0 ? '#fca5a5' : '#4ade80'};">${fmtMoney(invoice.amountDue)}</span></div>
    ${amountReceived > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:12px;"><span>Recebido</span><span style="font-family:monospace;color:#4ade80;">- ${fmtMoney(amountReceived)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:14px;font-weight:bold;"><span>SALDO EM ABERTO</span><span style="font-family:monospace;color:#fca5a5;">${fmtMoney(Math.max(0, invoice.amountDue - amountReceived))}</span></div>` : ''}
  </div>

  <div class="footer"><p>CENTRAL.PLACAS — Fatura Nº ${escHtml(invoice.number)} — Gerada em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[INVOICES/PDF] GET error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao gerar PDF' }, { status: 500 });
  }
}
