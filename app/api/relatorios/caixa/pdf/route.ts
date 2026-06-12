export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFileUrl } from '@/lib/s3';

function fmtMoney(v: number) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function fmtDateTime(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtTime(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s: string) {
  if (s === 'FECHADO') return 'Fechado';
  if (s === 'EM_CONFERENCIA') return 'Em Confer\u00eancia';
  return 'Aberto';
}

function typeLabel(t: string) {
  switch (t) {
    case 'ENTRADA': return 'Entrada';
    case 'SAIDA': return 'Sa\u00edda';
    case 'SUPRIMENTO': return 'Suprimento';
    case 'SANGRIA': return 'Sangria';
    default: return t;
  }
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getContentTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { data, summary, viewLabel } = await req.json();

    // --- Generate signed URLs for all attachments ---
    const attachmentUrls: Record<string, string> = {};
    for (const r of (data || [])) {
      for (const m of (r.movements || [])) {
        if (m.attachmentUrl && isImagePath(m.attachmentUrl)) {
          try {
            const ct = getContentTypeFromPath(m.attachmentUrl);
            const url = await getFileUrl(m.attachmentUrl, ct, false);
            attachmentUrls[m.id] = url;
          } catch (e) {
            console.error('Failed to get signed URL for', m.attachmentUrl, e);
          }
        }
      }
    }

    const summaryTableRows = (data || []).map((r: any) => {
      return '<tr>'
        + '<td>' + fmtDateTime(r.openDate) + '</td>'
        + '<td>' + (r.closeDate ? fmtDateTime(r.closeDate) : '-') + '</td>'
        + '<td>' + escHtml(r.responsible || '-') + '</td>'
        + '<td class="center">' + statusLabel(r.status) + '</td>'
        + '<td class="right">' + fmtMoney(r.initialBalance) + '</td>'
        + '<td class="right" style="color:#16a34a;">' + fmtMoney(r.entradas) + '</td>'
        + '<td class="right" style="color:#dc2626;">' + fmtMoney(r.saidas) + '</td>'
        + '<td class="right bold">' + fmtMoney(r.saldoSistema) + '</td>'
        + '</tr>';
    }).join('');

    const detailBlocks = (data || []).map((r: any, idx: number) => {
      const movs = r.movements || [];
      if (movs.length === 0) return '';

      const movRows = movs.map((m: any) => {
        const isEntry = m.type === 'ENTRADA' || m.type === 'SUPRIMENTO';
        const valColor = isEntry ? '#16a34a' : '#dc2626';
        const prefix = isEntry ? '+' : '-';
        const hasImg = !!attachmentUrls[m.id];
        return '<tr>'
          + '<td>' + fmtTime(m.createdAt) + '</td>'
          + '<td>' + typeLabel(m.type) + '</td>'
          + '<td>' + escHtml(m.description || '-') + '</td>'
          + '<td>' + escHtml(m.paymentMethod || '-') + '</td>'
          + '<td class="right" style="color:' + valColor + ';">' + prefix + ' ' + fmtMoney(m.amount) + '</td>'
          + '<td class="center">' + (hasImg ? '✓' : '') + '</td>'
          + '</tr>';
      }).join('');

      // Build attachments gallery for this register
      const attachedMovs = movs.filter((m: any) => !!attachmentUrls[m.id]);
      let attachmentGallery = '';
      if (attachedMovs.length > 0) {
        const imgs = attachedMovs.map((m: any) => {
          const url = attachmentUrls[m.id];
          const label = fmtTime(m.createdAt) + ' - ' + typeLabel(m.type) + ' - ' + escHtml(m.description || '-');
          return '<div class="attach-item">'
            + '<img src="' + url + '" />'
            + '<p>' + label + '</p>'
            + '<p class="attach-val">' + fmtMoney(m.amount) + '</p>'
            + '</div>';
        }).join('');
        attachmentGallery = '<div class="attach-section">'
          + '<h4>Comprovantes</h4>'
          + '<div class="attach-grid">' + imgs + '</div>'
          + '</div>';
      }

      const conferido = r.countedBalance !== null && r.countedBalance !== undefined
        ? fmtMoney(r.countedBalance)
        : '-';

      return '<div class="detail-block' + (idx > 0 ? ' page-break' : '') + '">'
        + '<div class="detail-header">'
        + '<h3>Caixa #' + (idx + 1) + ' — ' + escHtml(r.responsible || '-') + '</h3>'
        + '<div class="detail-info">'
        + '<div class="detail-info-row">'
        + '<p><b>Abertura:</b> ' + fmtDateTime(r.openDate) + '</p>'
        + '<p><b>Fechamento:</b> ' + (r.closeDate ? fmtDateTime(r.closeDate) : '-') + '</p>'
        + '<p><b>Status:</b> ' + statusLabel(r.status) + '</p>'
        + '</div>'
        + '<div class="detail-info-row">'
        + '<p><b>Saldo Inicial:</b> ' + fmtMoney(r.initialBalance) + '</p>'
        + '<p><b>Entradas:</b> <span style="color:#16a34a;">' + fmtMoney(r.entradas) + '</span></p>'
        + '<p><b>Saídas:</b> <span style="color:#dc2626;">' + fmtMoney(r.saidas) + '</span></p>'
        + '</div>'
        + '<div class="detail-info-row">'
        + '<p><b>Saldo Sistema:</b> ' + fmtMoney(r.saldoSistema) + '</p>'
        + '<p><b>Conferido:</b> ' + conferido + '</p>'
        + '<p><b>Movimentos:</b> ' + movs.length + '</p>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<table class="detail-table">'
        + '<thead><tr><th>Hora</th><th>Tipo</th><th>Descrição</th><th>Forma Pgto</th><th class="right">Valor</th><th class="center">Anexo</th></tr></thead>'
        + '<tbody>' + movRows + '</tbody>'
        + '</table>'
        + attachmentGallery
        + '</div>';
    }).join('');

    const htmlContent = '<!DOCTYPE html>'
      + '<html lang="pt-BR"><head><meta charset="UTF-8">'
      + '<style>'
      + '* { margin: 0; padding: 0; box-sizing: border-box; }'
      + 'body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #1E3A5F; font-size: 12px; }'
      + '.header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #1E3A5F; padding-bottom: 15px; }'
      + '.header h1 { font-size: 22px; color: #1E3A5F; }'
      + '.header h1 span { color: #2B7DB7; }'
      + '.header p { color: #666; font-size: 11px; margin-top: 4px; }'
      + '.info { margin-bottom: 20px; background: #f0f7ff; padding: 12px 15px; border-radius: 6px; display: flex; gap: 30px; flex-wrap: wrap; }'
      + '.info p { margin: 3px 0; font-size: 12px; }'
      + '.info b { color: #1E3A5F; }'
      + 'table { width: 100%; border-collapse: collapse; margin-top: 10px; }'
      + 'th { background: #1E3A5F; color: white; padding: 8px 6px; text-align: left; font-size: 10px; }'
      + 'td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }'
      + 'tr:nth-child(even) { background: #f9fbfd; }'
      + '.right { text-align: right; }'
      + '.center { text-align: center; }'
      + '.bold { font-weight: bold; }'
      + '.footer-row td { background: #1E3A5F; color: white; font-weight: bold; font-size: 11px; padding: 8px 6px; }'
      + '.footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }'
      + '.section-title { font-size: 16px; color: #1E3A5F; margin-top: 35px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #2B7DB7; }'
      + '.detail-block { margin-top: 20px; }'
      + '.detail-header h3 { font-size: 13px; color: #1E3A5F; margin-bottom: 8px; background: #e8f0fe; padding: 6px 10px; border-radius: 4px; }'
      + '.detail-info { background: #f0f7ff; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; }'
      + '.detail-info-row { display: flex; gap: 25px; margin: 2px 0; flex-wrap: wrap; }'
      + '.detail-info-row p { font-size: 11px; min-width: 180px; }'
      + '.detail-table th { font-size: 9px; }'
      + '.detail-table td { font-size: 9px; }'
      + '.page-break { page-break-before: always; }'
      + '.attach-section { margin-top: 15px; }'
      + '.attach-section h4 { font-size: 12px; color: #1E3A5F; margin-bottom: 8px; border-bottom: 1px solid #2B7DB7; padding-bottom: 4px; }'
      + '.attach-grid { display: flex; flex-wrap: wrap; gap: 12px; }'
      + '.attach-item { border: 1px solid #ddd; border-radius: 6px; padding: 6px; width: 220px; text-align: center; background: #fafafa; }'
      + '.attach-item img { max-width: 200px; max-height: 160px; object-fit: contain; border-radius: 4px; margin-bottom: 4px; }'
      + '.attach-item p { font-size: 8px; color: #555; margin: 2px 0; }'
      + '.attach-val { font-weight: bold; color: #1E3A5F; font-size: 9px !important; }'
      + '</style></head><body>'
      + '<div class="header">'
      + '<h1>CENTRAL<span>.PLACAS</span></h1>'
      + '<p>Relatório de Caixa — ' + escHtml(viewLabel || 'Todos') + '</p>'
      + '</div>'
      + '<div class="info">'
      + '<p><b>Registros:</b> ' + (summary?.totalRegistros ?? 0) + '</p>'
      + '<p><b>Entradas:</b> <span style="color:#16a34a;">' + fmtMoney(summary?.totalEntradas) + '</span></p>'
      + '<p><b>Saídas:</b> <span style="color:#dc2626;">' + fmtMoney(summary?.totalSaidas) + '</span></p>'
      + '<p><b>Saldo:</b> ' + fmtMoney(summary?.saldoTotal) + '</p>'
      + '</div>'
      + '<h2 class="section-title">Resumo dos Caixas</h2>'
      + '<table><thead><tr>'
      + '<th>Abertura</th><th>Fechamento</th><th>Responsável</th><th class="center">Status</th>'
      + '<th class="right">Saldo Ini.</th><th class="right">Entradas</th><th class="right">Saídas</th><th class="right">Saldo</th>'
      + '</tr></thead>'
      + '<tbody>' + (summaryTableRows || '<tr><td colspan="8" class="center">Nenhum registro encontrado.</td></tr>') + '</tbody>'
      + '<tfoot><tr class="footer-row"><td colspan="5" class="right">TOTAIS</td>'
      + '<td class="right">' + fmtMoney(summary?.totalEntradas) + '</td>'
      + '<td class="right">' + fmtMoney(summary?.totalSaidas) + '</td>'
      + '<td class="right">' + fmtMoney(summary?.saldoTotal) + '</td>'
      + '</tr></tfoot></table>'
      + (detailBlocks ? '<h2 class="section-title" style="margin-top:40px;">Detalhes dos Movimentos</h2>' + detailBlocks : '')
      + '<div class="footer"><p>CENTRAL.PLACAS — Documento gerado em ' + new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR') + '</p></div>'
      + '</body></html>';

    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: { format: 'A4', landscape: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }, print_background: true },
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
            'Content-Disposition': 'attachment; filename="relatorio_caixa.pdf"',
          },
        });
      } else if (statusResult?.status === 'FAILED') {
        return NextResponse.json({ error: 'Falha ao gerar PDF' }, { status: 500 });
      }
      attempts++;
    }
    return NextResponse.json({ error: 'Timeout ao gerar PDF' }, { status: 500 });
  } catch (error) {
    console.error('[RELATORIO-CAIXA] PDF error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
