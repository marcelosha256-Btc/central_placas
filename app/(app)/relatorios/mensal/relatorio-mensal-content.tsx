'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search, Loader2, X, FileText, FileSpreadsheet, MessageCircle,
  CheckCircle, Eye, Users, Hash, DollarSign, Send, Filter, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
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

interface PaymentInfo {
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

interface OrderInfo {
  orderNumber: number;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  items: { plateNumber: string; product: string; quantity: number; unitPrice: number }[];
  payments: PaymentInfo[];
}

interface ClienteSummary {
  totalPedidos: number;
  totalPlacas: number;
  totalGeral: number;
  totalPago: number;
  totalAberto: number;
}

interface ClienteEnvio {
  customer: { id: string; name: string; whatsapp: string; document: string; monthlyReport: boolean; reportType?: string };
  pedidos: number;
  placas: PlacaItem[];
  orders: OrderInfo[];
  summary: ClienteSummary;
  totalAberto: number;
  totalPago: number;
  totalGeralPedidos: number;
  saldoAnterior: number;
  totalGeral: number;
  sent?: boolean;
  sending?: boolean;
}

const PAYMENT_LABELS: Record<string, string> = {
  'PIX': 'PIX', 'Dinheiro': 'Dinheiro', 'Cartão Crédito': 'Cartão Crédito',
  'Cartão Débito': 'Cartão Débito', 'Transferência': 'Transferência', 'Boleto': 'Boleto',
  'A_PRAZO': 'A Prazo',
};

export function RelatorioMensalContent() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClienteEnvio[]>([]);
  const [summary, setSummary] = useState({ totalClientes: 0, totalPlacas: 0, totalAberto: 0, totalSaldoAnterior: 0, totalGeral: 0, totalEnviados: 0 });
  const [generated, setGenerated] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [apenasEnvioMensal, setApenasEnvioMensal] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);

  const [viewClient, setViewClient] = useState<ClienteEnvio | null>(null);
  const [whatsClient, setWhatsClient] = useState<ClienteEnvio | null>(null);
  const [whatsMsg, setWhatsMsg] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingAllPdf, setGeneratingAllPdf] = useState(false);
  const [generatingXls, setGeneratingXls] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!pdfDropdownOpen) return;
    const handler = () => setPdfDropdownOpen(null);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [pdfDropdownOpen]);

  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(first.toISOString().slice(0, 10));
    setDateTo(last.toISOString().slice(0, 10));
    fetch('/api/customers?all=1').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : d?.customers ?? [])).catch(() => {});
  }, []);

  const handleGerar = async () => {
    if (!dateFrom || !dateTo) { toast.error('Informe o período'); return; }

    setLoading(true);
    setGenerated(false);
    try {
      const params = new URLSearchParams({
        dateFrom, dateTo, situacao,
        ...(apenasEnvioMensal ? { apenasEnvioMensal: '1' } : {}),
        ...(clienteId ? { clienteId } : {}),
      });
      const res = await fetch(`/api/relatorios/mensal?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData((json.data ?? []).map((d: any) => ({ ...d, sent: false })));
      setSummary(json.summary ?? { totalClientes: 0, totalPlacas: 0, totalAberto: 0, totalSaldoAnterior: 0, totalGeral: 0, totalEnviados: 0 });
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

  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  const buildWhatsMsg = (c: ClienteEnvio) => {
    const firstName = c.customer.name.split(' ')[0];
    const qtd = c.placas.length;
    let msg = `Olá, *${firstName}*! 👋\n\nAqui é da *CENTRAL.PLACAS*. Segue o relatório de placas referente ao período de *${formatPeriod()}*:\n\n📦 Placas produzidas: *${qtd} ${qtd === 1 ? 'unidade' : 'unidades'}*\n💰 Total em aberto: *${formatCurrency(c.totalAberto)}*`;
    if (c.saldoAnterior > 0) {
      msg += `\n📋 Saldo anterior: *${formatCurrency(c.saldoAnterior)}*\n📊 Total geral: *${formatCurrency(c.totalGeral)}*`;
    }
    msg += '\n\n📎 PDF detalhado em anexo.\n\nQualquer dúvida estamos à disposição. Obrigado! 🙏';
    return msg;
  };

  const openWhatsApp = async (c: ClienteEnvio) => {
    if (!c.customer.whatsapp) {
      toast.error('Cliente sem WhatsApp cadastrado');
    }
    setPdfDownloaded(false);
    setWhatsClient(c);
    setWhatsMsg(buildWhatsMsg(c));
    try {
      await downloadPdf(c);
      setPdfDownloaded(true);
    } catch {
      toast.error('Erro ao gerar PDF, mas você pode continuar.');
    }
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
      await fetch('/api/relatorios/mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markSent',
          customerId: c.customer.id,
          periodStart: dateFrom,
          periodEnd: dateTo,
          totalAmount: c.totalGeral,
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
    for (const c of selected) { await markSent(c, 'MANUAL'); }
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

  const getClientDefaultFormat = (c: ClienteEnvio) => c.customer.reportType === 'resumido' ? 'resumido' : 'detalhado';

  const downloadPdf = async (c: ClienteEnvio, formatOverride?: string) => {
    setPdfDropdownOpen(null);
    setGeneratingPdf(c.customer.id);
    const fmt = formatOverride || getClientDefaultFormat(c);
    try {
      const res = await fetch('/api/relatorios/mensal/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Enviamos só identificadores — o servidor calcula os números (fonte única).
        body: JSON.stringify({
          clienteId: c.customer.id,
          dateFrom,
          dateTo,
          situacao,
          format: fmt,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_mensal_${c.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF (${fmt === 'resumido' ? 'Resumido' : 'Detalhado'}) gerado com sucesso!`);
    } catch { toast.error('Erro ao gerar PDF'); }
    setGeneratingPdf(null);
  };

  const downloadAllPdf = async () => {
    setGeneratingAllPdf(true);
    try {
      const res = await fetch('/api/relatorios/mensal/pdf-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Identificadores — servidor recalcula todos os clientes (fonte única).
        body: JSON.stringify({ dateFrom, dateTo, situacao, apenasEnvioMensal }),
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_mensal_consolidado.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF consolidado gerado com sucesso!');
    } catch { toast.error('Erro ao gerar PDF consolidado'); }
    setGeneratingAllPdf(false);
  };

  const downloadXls = async (c: ClienteEnvio) => {
    setGeneratingXls(c.customer.id);
    try {
      const res = await fetch('/api/relatorios/mensal/xls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Identificadores — servidor calcula os números (fonte única).
        body: JSON.stringify({ clienteId: c.customer.id, dateFrom, dateTo, situacao }),
      });
      if (!res.ok) throw new Error('Falha ao gerar XLS');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_mensal_${c.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('XLS gerado com sucesso!');
    } catch { toast.error('Erro ao gerar XLS'); }
    setGeneratingXls(null);
  };

  const fmtDateLocal = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Relatório Mensal</h1>
        <p className="text-sm text-gray-500 mt-1">Gere relatórios mensais com saldo anterior e envie cobranças via WhatsApp</p>
      </div>

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
              <option value="todos">Todos</option>
              <option value="aberto">Em aberto</option>
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
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={apenasEnvioMensal} onChange={e => setApenasEnvioMensal(e.target.checked)} className="rounded border-gray-300 text-[#2B7DB7] focus:ring-[#2B7DB7]" />
              Apenas envio mensal
            </label>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users className="w-3.5 h-3.5" /> Clientes</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalClientes}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Hash className="w-3.5 h-3.5" /> Placas</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalPlacas}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Aberto (Período)</div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalAberto)}</p>
          </div>
          {summary.totalSaldoAnterior > 0 && (
            <div className="bg-white rounded-xl p-4 border-l-4 border-amber-400" style={{ boxShadow: 'var(--shadow-md)' }}>
              <div className="flex items-center gap-2 text-amber-600 text-xs mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Saldo Anterior</div>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.totalSaldoAnterior)}</p>
            </div>
          )}
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Total Geral</div>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.totalGeral)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Send className="w-3.5 h-3.5" /> Enviados</div>
            <p className="text-2xl font-bold text-green-600">{summary.totalEnviados}</p>
          </div>
        </div>
      )}

      {/* Tabela */}
      {generated && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Relatórios por Cliente</h3>
            {data.length > 0 && (
              <button onClick={downloadAllPdf} disabled={generatingAllPdf} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {generatingAllPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Exportar Todos em PDF
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">Período: {formatPeriod()}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs">
                  <th className="pb-3 w-10">
                    <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === data.filter(d => !d.sent).length} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3 text-center">Placas</th>
                  <th className="pb-3 text-right">Período</th>
                  {summary.totalSaldoAnterior > 0 && <th className="pb-3 text-right">Saldo Ant.</th>}
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">Nenhum cliente encontrado para os filtros selecionados.</td></tr>
                ) : data.map((c) => (
                  <tr key={c.customer.id} className={`border-b last:border-0 ${c.sent ? 'bg-green-50' : ''}`}>
                    <td className="py-3">
                      <input type="checkbox" checked={selectedIds.has(c.customer.id)} onChange={() => toggleSelect(c.customer.id)} disabled={c.sent} className="rounded" />
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-[#1E3A5F]">{c.customer.name}</span>
                      {c.sent && <span className="ml-2 text-xs text-green-600 font-medium">✅ Enviado</span>}
                      {c.saldoAnterior > 0 && !c.sent && (
                        <span className="ml-2 text-xs text-amber-600 font-medium">⚠️ Saldo anterior</span>
                      )}
                    </td>
                    <td className="py-3 text-center font-mono font-bold">{c.placas.length}</td>
                    <td className="py-3 text-right font-mono text-red-600">{formatCurrency(c.totalAberto)}</td>
                    {summary.totalSaldoAnterior > 0 && (
                      <td className="py-3 text-right font-mono text-amber-600 font-bold">{c.saldoAnterior > 0 ? formatCurrency(c.saldoAnterior) : '-'}</td>
                    )}
                    <td className="py-3 text-right font-mono font-bold text-red-700">{formatCurrency(c.totalGeral)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button onClick={() => setViewClient(c)} className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Ver</button>
                        <button onClick={() => downloadPdf(c)} disabled={generatingPdf === c.customer.id} className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors flex items-center gap-1">
                          {generatingPdf === c.customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
                        </button>
                        <button onClick={() => downloadXls(c)} disabled={generatingXls === c.customer.id} className="text-xs px-2.5 py-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors flex items-center gap-1">
                          {generatingXls === c.customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} XLS
                        </button>
                        <button onClick={() => openWhatsApp(c)} className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        {!c.sent && (
                          <button onClick={() => markSent(c, 'MANUAL')} className="text-xs px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors flex items-center gap-1">
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

      {/* Modal Visualizar — Redesenhado com blocos de pedido */}
      {viewClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F]">Relatório Mensal — {viewClient.customer.name}</h2>
              <button onClick={() => setViewClient(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm space-y-1 border-l-4 border-[#2B7DB7]">
              <p><strong>Período:</strong> {formatPeriod()}</p>
              <p><strong>Pedidos:</strong> {viewClient.summary?.totalPedidos ?? viewClient.pedidos} | <strong>Placas:</strong> {viewClient.summary?.totalPlacas ?? viewClient.placas.length}</p>
            </div>

            {/* Order blocks */}
            {(viewClient.orders && viewClient.orders.length > 0) ? viewClient.orders.map((order, idx) => {
              const statusColor = order.remaining <= 0 ? 'bg-green-100 text-green-700' : order.paidAmount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
              const statusLabel = order.remaining <= 0 ? 'PAGO' : order.paidAmount > 0 ? 'PARCIAL' : 'EM ABERTO';
              return (
                <div key={idx} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Order header */}
                  <div className="bg-[#1E3A5F] text-white px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">Pedido #{order.orderNumber}</span>
                      <span className="text-xs opacity-80">{fmtDateLocal(order.createdAt)}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${statusColor}`}>{statusLabel}</span>
                  </div>

                  {/* Items */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <th className="px-4 py-2 text-left">Placa</th>
                        <th className="px-4 py-2 text-left">Produto</th>
                        <th className="px-4 py-2 text-center">Qtd</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((it, j) => (
                        <tr key={j} className="border-b last:border-0">
                          <td className="px-4 py-2 font-mono text-base font-bold text-[#1E3A5F] tracking-wide">{it.plateNumber}</td>
                          <td className="px-4 py-2 text-xs">{it.product}</td>
                          <td className="px-4 py-2 text-center text-xs">{it.quantity}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{formatCurrency(it.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Payments */}
                  {order.payments && order.payments.length > 0 && (
                    <div className="border-t border-dashed border-gray-200 bg-gray-50 px-4 py-2">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-0.5">Pagamentos Realizados</p>
                      <p className="text-xs text-[#1E3A5F] mb-1">Placas: <span className="font-mono font-bold tracking-wide">{order.items.map(it => it.plateNumber).filter(p => p && p !== '-').join(', ') || '-'}</span></p>
                      {order.payments.map((p, k) => (
                        <div key={k} className="flex justify-between items-center text-xs py-0.5">
                          <span>{fmtDateLocal(p.createdAt)} — {PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}</span>
                          <span className="font-mono font-bold text-green-600">+ {formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Order totals */}
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      <span>Total: <b className="text-[#1E3A5F]">{formatCurrency(order.totalAmount)}</b></span>
                      <span className="ml-4">Pago: <b className="text-green-600">{formatCurrency(order.paidAmount)}</b></span>
                    </div>
                    <div className={`text-sm font-bold ${order.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {order.remaining > 0 ? `Restante: ${formatCurrency(order.remaining)}` : '✓ Quitado'}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-gray-400 py-6">Nenhum pedido encontrado no período.</p>
            )}

            {/* Summary box */}
            <div className="bg-[#1E3A5F] text-white rounded-lg p-4 mt-2">
              <div className="flex justify-between items-center text-sm">
                <span>Total do Período</span>
                <span className="font-mono">{formatCurrency(viewClient.summary?.totalGeral ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Total Pago</span>
                <span className="font-mono text-green-300">{formatCurrency(viewClient.summary?.totalPago ?? viewClient.totalPago ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold mt-2 pt-2 border-t border-white/30">
                <span>RESTANTE (PERÍODO)</span>
                <span className={`font-mono ${viewClient.totalAberto > 0 ? 'text-red-300' : 'text-green-300'}`}>{formatCurrency(viewClient.totalAberto)}</span>
              </div>
            </div>

            {/* Saldo Anterior */}
            {viewClient.saldoAnterior > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-amber-700">⚠️ Saldo Anterior</span>
                  <span className="font-mono font-bold text-amber-700">{formatCurrency(viewClient.saldoAnterior)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Restante do período</span>
                  <span className="font-mono">{formatCurrency(viewClient.totalAberto)}</span>
                </div>
                <div className="flex justify-between items-center text-base font-bold mt-1 pt-1 border-t border-amber-300 text-red-700">
                  <span>TOTAL GERAL A PAGAR</span>
                  <span className="font-mono">{formatCurrency(viewClient.totalGeral)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4 justify-end">
              <div className="relative">
                <div className="flex items-stretch">
                  <button onClick={() => downloadPdf(viewClient)} disabled={generatingPdf === viewClient.customer.id} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-l-lg text-sm font-medium flex items-center gap-2">
                    {generatingPdf === viewClient.customer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF {getClientDefaultFormat(viewClient) === 'resumido' ? '(Resumido)' : '(Detalhado)'}
                  </button>
                  <button onClick={() => setPdfDropdownOpen(pdfDropdownOpen === 'view' ? null : 'view')} className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-r-lg text-sm border-l border-red-500">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                {pdfDropdownOpen === 'view' && (
                  <div className="absolute right-0 bottom-full mb-1 bg-white rounded-md shadow-lg border z-50 py-1 min-w-[150px]">
                    <button onClick={() => downloadPdf(viewClient, 'detalhado')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Detalhado
                    </button>
                    <button onClick={() => downloadPdf(viewClient, 'resumido')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Resumido
                    </button>
                  </div>
                )}
              </div>
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
            {pdfDownloaded && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 text-xs text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>PDF baixado com sucesso! Ao abrir o WhatsApp, clique no 📎 (anexo) e selecione o PDF que acabou de baixar.</span>
              </div>
            )}
            {!pdfDownloaded && generatingPdf && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs text-blue-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                <span>Gerando PDF do relatório...</span>
              </div>
            )}
            <p className="text-xs text-gray-500 mb-3">Mensagem pronta para {whatsClient.customer.name}. Edite se necessário:</p>
            <textarea
              value={whatsMsg}
              onChange={e => setWhatsMsg(e.target.value)}
              rows={8}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none resize-vertical mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { navigator.clipboard?.writeText(whatsMsg); toast.success('Mensagem copiada!'); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Copiar</button>
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
