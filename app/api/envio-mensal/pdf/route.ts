export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { customerName, periodStart, periodEnd, placas, totalAberto } = await req.json();

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #1E3A5F; font-size: 12px; }
    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #1E3A5F; padding-bottom: 15px; }
    .header h1 { font-size: 22px; color: #1E3A5F; }
    .header h1 span { color: #2B7DB7; }
    .header p { color: #666; font-size: 11px; margin-top: 4px; }
    .info { margin-bottom: 20px; background: #f0f7ff; padding: 12px 15px; border-radius: 6px; }
    .info p { margin: 3px 0; font-size: 12px; }
    .info b { color: #1E3A5F; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1E3A5F; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
    tr:nth-child(even) { background: #f9fbfd; }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .footer-row td { background: #1E3A5F; color: white; font-weight: bold; font-size: 12px; padding: 10px; }
    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CENTRAL<span>.PLACAS</span></h1>
    <p>Relatório de Placas — Período: ${periodStart} a ${periodEnd}</p>
  </div>
  <div class="info">
    <p><b>Cliente:</b> ${customerName}</p>
    <p><b>Quantidade de placas:</b> ${(placas || []).length}</p>
    <p><b>Total em aberto:</b> R$ ${Number(totalAberto || 0).toFixed(2).replace('.', ',')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Pedido</th>
        <th>Placa</th>
        <th>Produto</th>
        <th>Status</th>
        <th class="right">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${(placas || []).length > 0 ? (placas || []).map((p: any) => `
        <tr>
          <td>${p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-'}</td>
          <td class="center">#${p.orderNumber || '-'}</td>
          <td class="bold">${p.plateNumber || '-'}</td>
          <td>${p.product || '-'}</td>
          <td>${p.status || '-'}</td>
          <td class="right">R$ ${Number(p.unitPrice || 0).toFixed(2).replace('.', ',')}</td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="center">Nenhuma placa encontrada.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="footer-row">
        <td colspan="5" class="right">TOTAL EM ABERTO</td>
        <td class="right">R$ ${Number(totalAberto || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">
    <p>CENTRAL.PLACAS — Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
  </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[ENVIO-MENSAL] PDF error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
