'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, X, FileText, FileSpreadsheet, MessageCircle,
  CheckCircle, Download, Eye, Users, Hash, DollarSign, Send, Filter,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

interface PlacaItem {
  orderId: string;
  orderNumber: number;
  date: string;
  plateNumber: string;
  product: string;
  unitPrice: number;
  totalPrice: number;
  orderTotal: number;
  orderPaid: number;
  orderBalance: number;
  status: string;
}

interface ClienteEnvio {
  customer: { id: string; name: string; whatsapp: string; document: string; monthlyReport: boolean };
  pedidos: number;
  placas: PlacaItem[];
  totalAberto: number;
  sent?: boolean;
  sending?: boolean;
}

export function EnvioMensalContent() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClienteEnvio[]>([]);
  const [summary, setSummary] = useState({ totalClientes: 0, totalPlacas: 0, totalAberto: 0, totalEnviados: 0 });
  const [generated, setGenerated] = useState(false);

  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [situacao, setSituacao] = useState('aberto');
  const [modo, setModo] = useState('abertos');
  const [clienteId, setClienteId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);

  // Modais
  const [viewClient, setViewClient] = useState<ClienteEnvio | null>(null);
  const [whatsClient, setWhatsClient] = useState<ClienteEnvio | null>(null);
  const [whatsMsg, setWhatsMsg] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingXls, setGeneratingXls] = useState<string | null>(null);

  // Selecionar todos
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Set default dates to current month
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(first.toISOString().slice(0, 10));
    setDateTo(last.toISOString().slice(0, 10));

    fetch('/api/customers?all=1').then(r => r.json()).then(d => setCustomers(d?.customers ?? [])).catch(() => {});
  }, []);

  const handleGerar = async () => {
    if (!dateFrom || !dateTo) { toast.error('Informe o período'); return; }
    if (modo === 'selecionado' && !clienteId) { toast.error('Selecione um cliente'); return; }

    setLoading(true);
    setGenerated(false);
    try {
      const params = new URLSearchParams({
        dateFrom, dateTo, situacao, modo,
        ...(clienteId ? { clienteId } : {}),
      });
      const res = await fetch(`/api/envio-mensal?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData((json.data ?? []).map((d: any) => ({ ...d, sent: false })));
      setSummary(json.summary ?? { totalClientes: 0, totalPlacas: 0, totalAberto: 0, totalEnviados: 0 });
      setGenerated(true);
      setSelectedIds(new Set());
      toast.success(`${json.data?.length ?? 0} cliente(s) encontrado(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar');
    }
    setLoading(false);
  };

  const formatPeriod = () => {
    if (!dateFrom || !dateTo) return '';
    return `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  };

  const buildWhatsMsg = (c: ClienteEnvio) => {
    const firstName = c.customer.name.split(' ')[0];
    const qtd = c.placas.length;
    return `Olá, *${firstName}*! 👋\n\nAqui é da *CENTRAL.PLACAS*. Segue o relatório de placas referente ao período de *${formatPeriod()}*:\n\n📦 Placas produzidas: *${qtd} ${qtd === 1 ? 'unidade' : 'unidades'}*\n💰 Total em aberto: *${formatCurrency(c.totalAberto)}*\n\n📎 PDF detalhado em anexo.\n\nQualquer dúvida estamos à disposição. Obrigado! 🙏`;
  };

  const openWhatsApp = (c: ClienteEnvio) => {
    if (!c.customer.whatsapp) {
      setWhatsClient(c);
      setWhatsMsg(buildWhatsMsg(c));
      toast.error('Cliente sem WhatsApp cadastrado');
      return;
    }
    setWhatsClient(c);
    setWhatsMsg(buildWhatsMsg(c));
  };

  const sendWhatsApp = (c: ClienteEnvio) => {
    const phone = (c.customer.whatsapp || '').replace(/\D/g, '');
    if (!phone) { toast.error('Cliente sem WhatsApp'); return; }
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(whatsMsg)}`;
    window.open(url, '_blank');
    markSent(c);
  };

  const markSent = async (c: ClienteEnvio, via = 'WHATSAPP') => {
    try {
      await fetch('/api/envio-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markSent',
          customerId: c.customer.id,
          periodStart: dateFrom,
          periodEnd: dateTo,
          totalAmount: c.totalAberto,
          plateCount: c.placas.length,
          sentVia: via,
        }),
      });
      setData(prev => prev.map(d => d.customer.id === c.customer.id ? { ...d, sent: true } : d));
      setSummary(prev => ({ ...prev, totalEnviados: prev.totalEnviados + 1 }));
    } catch { toast.error('Erro ao marcar envio'); }
  };

  const markSelectedSent = async () => {
    const selected = data.filter(d => selectedIds.has(d.customer.id) && !d.sent);
    if (!selected.length) { toast.error('Nenhum cliente selecionado'); return; }
    for (const c of selected) {
      await markSent(c, 'MANUAL');
    }
    setSelectedIds(new Set());
    toast.success(`${selected.length} cliente(s) marcado(s) como enviado(s)`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.filter(d => !d.sent).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.filter(d => !d.sent).map(d => d.customer.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const downloadPdf = async (c: ClienteEnvio) => {
    setGeneratingPdf(c.customer.id);
    try {
      const res = await fetch('/api/envio-mensal/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: c.customer.name,
          periodStart: new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR'),
          periodEnd: new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR'),
          placas: c.placas,
          totalAberto: c.totalAberto,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_${c.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
    setGeneratingPdf(null);
  };

  const downloadXls = async (c: ClienteEnvio) => {
    setGeneratingXls(c.customer.id);
    try {
      const res = await fetch('/api/envio-mensal/xls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: c.customer.name,
          periodStart: new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR'),
          periodEnd: new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR'),
          placas: c.placas,
          totalAberto: c.totalAberto,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar XLS');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_${c.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('XLS gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar XLS');
    }
    setGeneratingXls(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Envio Mensal</h1>
          <p className="text-sm text-gray-500 mt-1">Gere relatórios e envie cobranças para seus clientes via WhatsApp</p>
        </div>
      </div>

      {/* Tip box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        💡 <strong>Fluxo:</strong> Selecione o período e filtros → Gere os relatórios → Baixe o PDF/XLS → Envie pelo WhatsApp com a mensagem pronta.
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-sm font-semibold text-[#1E3A5F] mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Data Inicial</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Data Final</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Situação</label>
            <select value={situacao} onChange={e => setSituacao(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
              <option value="aberto">Em aberto</option>
              <option value="todos">Todos</option>
              <option value="pago">Pagos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
              <option value="">Todos</option>
              {(customers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Gerar para</label>
            <select value={modo} onChange={e => setModo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
              <option value="abertos">Clientes com saldo em aberto</option>
              <option value="mensal">Marcados para envio mensal</option>
              <option value="periodo">Com pedidos no período</option>
              <option value="todos">Todos os clientes</option>
              <option value="selecionado">Cliente selecionado</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={handleGerar} disabled={loading} className="bg-[#2B7DB7] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Gerar Relatórios
          </button>
          {generated && data.length > 0 && (
            <button onClick={markSelectedSent} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Marcar selecionados como enviados
            </button>
          )}
        </div>
      </div>

      {/* Cards Resumo */}
      {generated && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users className="w-3.5 h-3.5" /> Clientes</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalClientes}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Hash className="w-3.5 h-3.5" /> Placas</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalPlacas}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Total em Aberto</div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalAberto)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Send className="w-3.5 h-3.5" /> Enviados</div>
            <p className="text-2xl font-bold text-green-600">{summary.totalEnviados}</p>
          </div>
        </div>
      )}

      {/* Tabela Clientes */}
      {generated && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">Relatórios por Cliente</h3>
          <p className="text-xs text-gray-500 mb-4">Período: {formatPeriod()}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs">
                  <th className="pb-3 w-10">
                    <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === data.filter(d => !d.sent).length} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">WhatsApp</th>
                  <th className="pb-3 text-center">Placas</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhum cliente encontrado para os filtros selecionados.</td></tr>
                ) : data.map((c) => (
                  <tr key={c.customer.id} className={`border-b last:border-0 ${c.sent ? 'bg-green-50' : ''}`}>
                    <td className="py-3">
                      <input type="checkbox" checked={selectedIds.has(c.customer.id)} onChange={() => toggleSelect(c.customer.id)} disabled={c.sent} className="rounded" />
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-[#1E3A5F]">{c.customer.name}</span>
                      {c.sent && <span className="ml-2 text-xs text-green-600 font-medium">✅ Enviado</span>}
                      {c.placas.length === 0 && <span className="ml-2 text-xs text-gray-400">Sem placas no filtro</span>}
                    </td>
                    <td className="py-3 text-xs text-gray-600">{c.customer.whatsapp || <span className="text-gray-300">Não cadastrado</span>}</td>
                    <td className="py-3 text-center font-mono font-bold">{c.placas.length}</td>
                    <td className="py-3 text-right font-mono font-bold text-red-600">{formatCurrency(c.totalAberto)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button onClick={() => setViewClient(c)} className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1" title="Visualizar">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                        <button onClick={() => downloadPdf(c)} disabled={generatingPdf === c.customer.id} className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors flex items-center gap-1" title="Baixar PDF">
                          {generatingPdf === c.customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
                        </button>
                        <button onClick={() => downloadXls(c)} disabled={generatingXls === c.customer.id} className="text-xs px-2.5 py-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors flex items-center gap-1" title="Baixar XLS">
                          {generatingXls === c.customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} XLS
                        </button>
                        <button onClick={() => openWhatsApp(c)} className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1" title="Enviar WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        {!c.sent && (
                          <button onClick={() => markSent(c, 'MANUAL')} className="text-xs px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors flex items-center gap-1" title="Marcar como enviado">
                            <CheckCircle className="w-3.5 h-3.5" /> Enviado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Visualizar */}
      {viewClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F]">Relatório — {viewClient.customer.name}</h2>
              <button onClick={() => setViewClient(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <p><strong>Período:</strong> {formatPeriod()}</p>
              <p><strong>Placas:</strong> {viewClient.placas.length}</p>
              <p><strong>Total em aberto:</strong> <span className="text-red-600 font-bold">{formatCurrency(viewClient.totalAberto)}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 text-xs">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Pedido</th>
                    <th className="pb-2">Placa</th>
                    <th className="pb-2">Produto</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {viewClient.placas.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400">Nenhuma placa encontrada.</td></tr>
                  ) : viewClient.placas.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 text-xs">{p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="py-2 text-xs">#{p.orderNumber}</td>
                      <td className="py-2 font-mono text-base font-bold text-[#1E3A5F] tracking-wide">{p.plateNumber}</td>
                      <td className="py-2 text-xs">{p.product}</td>
                      <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'Pago' ? 'bg-green-100 text-green-700' : p.status === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span></td>
                      <td className="py-2 text-right font-mono">{formatCurrency(p.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                {viewClient.placas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#1E3A5F]">
                      <td colSpan={5} className="py-2 text-right font-bold text-[#1E3A5F]">TOTAL EM ABERTO</td>
                      <td className="py-2 text-right font-bold font-mono text-red-600">{formatCurrency(viewClient.totalAberto)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => downloadPdf(viewClient)} disabled={generatingPdf === viewClient.customer.id} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                {generatingPdf === viewClient.customer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Baixar PDF
              </button>
              <button onClick={() => downloadXls(viewClient)} disabled={generatingXls === viewClient.customer.id} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                {generatingXls === viewClient.customer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Baixar XLS
              </button>
              <button onClick={() => setViewClient(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp */}
      {whatsClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /> Mensagem WhatsApp</h2>
              <button onClick={() => setWhatsClient(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Mensagem pronta para {whatsClient.customer.name}. Edite se necessário:</p>
            <textarea
              value={whatsMsg}
              onChange={e => setWhatsMsg(e.target.value)}
              rows={8}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none resize-vertical mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { navigator.clipboard?.writeText(whatsMsg); toast.success('Mensagem copiada!'); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                Copiar
              </button>
              <button onClick={() => sendWhatsApp(whatsClient)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
              </button>
              <button onClick={() => setWhatsClient(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
