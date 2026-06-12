'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Package, Plus, Loader2, X, AlertTriangle, DollarSign,
  Boxes, ArrowDownCircle, SlidersHorizontal, History,
  TrendingDown, Clock, ShoppingCart, BarChart2, Trash2,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface ReportRow {
  month: string;
  label: string;
  entradaQty: number;
  entradaCost: number;
  saidaQty: number;
  avariaQty: number;
  balanceFinal: number | null;
}
interface ReportProduct { id: string; description: string; code: string; }
interface ReportData {
  products: ReportProduct[];
  monthKeys: string[];
  report: Record<string, ReportRow[]>;
}

interface StockProduct {
  id: string;
  code: string;
  description: string;
  category: string;
  stockQuantity: number;
  minStock: number;
  basePrice: number;
  avgCost: number;
  stockValueReal: number;
  dailyAvg: number;
  consumed60: number;
  avaria60: number;
  efficiency: number | null;
  committedQty: number;
  availableQty: number;
  daysRemaining: number | null;
  suggestedOrder30: number;
  orderUrgent: boolean;
  orderSoon: boolean;
  overCommitted: boolean;
  leadTimeDays: number;
  active: boolean;
}

interface Summary {
  total: number;
  belowMin: number;
  overCommittedCount: number;
  totalQty: number;
  totalAvailable: number;
  totalCommitted: number;
  stockValue: number;
  minDays: number | null;
  minDaysProduct: string;
}

export function EstoqueContent() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, belowMin: 0, overCommittedCount: 0, totalQty: 0, totalAvailable: 0, totalCommitted: 0, stockValue: 0, minDays: null, minDaysProduct: '' });
  const [baseProducts, setBaseProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<'saldo' | 'relatorio'>('saldo');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportMonths, setReportMonths] = useState<3 | 6 | 12>(6);

  const loadReport = useCallback(async (months = 6) => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/stock/report?months=${months}`);
      const data = await res.json();
      setReport(data);
    } catch { toast.error('Erro ao carregar relatório'); }
    setLoadingReport(false);
  }, []);

  const [showEntrada, setShowEntrada] = useState(false);
  const [showAjuste, setShowAjuste] = useState<StockProduct | null>(null);
  const [showAvaria, setShowAvaria] = useState<StockProduct | null>(null);
  const [avaria, setAvaria] = useState({ quantity: '', motivo: 'Defeito fornecedor', observacao: '' });
  const [historyProduct, setHistoryProduct] = useState<StockProduct | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const [entrada, setEntrada] = useState({ productId: '', quantity: '', unitCost: '', reason: '' });
  const [ajuste, setAjuste] = useState({ newCount: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock');
      const data = await res.json();
      setProducts(data?.products ?? []);
      setSummary(data?.summary ?? { total: 0, belowMin: 0, stockValue: 0, minDays: null, minDaysProduct: '' });
    } catch { toast.error('Erro ao carregar estoque'); }
    setLoading(false);
  }, []);

  // Fix 1: só carrega produtos com trackStock=true para a entrada
  useEffect(() => {
    fetch('/api/products?all=1')
      .then(r => r.json())
      .then(d => setBaseProducts((Array.isArray(d) ? d : []).filter((p: any) => p.trackStock)))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEntrada = (productId = '') => {
    setEntrada({ productId, quantity: '', unitCost: '', reason: '' });
    setShowEntrada(true);
  };

  const saveEntrada = async () => {
    if (!entrada.productId) { toast.error('Selecione o produto'); return; }
    if (!entrada.quantity || parseFloat(entrada.quantity) <= 0) { toast.error('Informe a quantidade'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entrada, type: 'ENTRADA' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Entrada registrada!');
      setShowEntrada(false);
      load();
    } catch { toast.error('Erro ao registrar entrada'); }
    setSaving(false);
  };

  const saveAjuste = async () => {
    if (!showAjuste) return;
    if (ajuste.newCount === '' || parseFloat(ajuste.newCount) < 0) { toast.error('Informe a contagem'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: showAjuste.id, type: 'AJUSTE', newCount: ajuste.newCount, reason: ajuste.reason }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Estoque ajustado!');
      setShowAjuste(null);
      load();
    } catch { toast.error('Erro ao ajustar'); }
    setSaving(false);
  };

  const openHistory = async (p: StockProduct) => {
    setHistoryProduct(p);
    setLoadingHist(true);
    setMovements([]);
    try {
      const res = await fetch(`/api/stock/movements?productId=${p.id}`);
      const data = await res.json();
      setMovements(data?.movements ?? []);
    } catch { toast.error('Erro ao carregar histórico'); }
    setLoadingHist(false);
  };

  const reverseAvaria = async (movementId: string) => {
    if (!confirm('Estornar esta avaria? O estoque será devolvido.')) return;
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); return; }
      toast.success('Avaria estornada! Estoque devolvido.');
      if (historyProduct) openHistory(historyProduct);
      load();
    } catch { toast.error('Erro ao estornar avaria'); }
  };

  const movColor = (type: string) =>
    type === 'ENTRADA' ? 'text-green-600'
    : type === 'SAIDA' ? 'text-red-600'
    : type === 'AVARIA' ? 'text-orange-600'
    : 'text-blue-600';
  const movSign = (m: any) => {
    if (m.type === 'ENTRADA') return `+${m.quantity}`;
    if (m.type === 'SAIDA') return `-${m.quantity}`;
    if (m.type === 'AVARIA') return `-${m.quantity}`;
    return `${m.quantity > 0 ? '+' : ''}${m.quantity}`;
  };
  const movLabel = (type: string) =>
    type === 'ENTRADA' ? 'Entrada'
    : type === 'SAIDA' ? 'Saída'
    : type === 'AVARIA' ? 'Avaria'
    : 'Ajuste';

  const saveAvaria = async () => {
    if (!showAvaria) return;
    if (!avaria.quantity || parseFloat(avaria.quantity) <= 0) { toast.error('Informe a quantidade'); return; }
    setSaving(true);
    try {
      const reason = avaria.observacao
        ? `${avaria.motivo}: ${avaria.observacao}`
        : avaria.motivo;
      const res = await fetch('/api/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: showAvaria.id, type: 'AVARIA', quantity: avaria.quantity, reason }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Avaria registrada!');
      setShowAvaria(null);
      load();
    } catch { toast.error('Erro ao registrar avaria'); }
    setSaving(false);
  };

  // Status de dias restantes — leva em conta o lead time do fornecedor
  const daysStatus = (days: number | null, leadTime = 7) => {
    if (days === null) return { label: '—', color: 'text-gray-400', bg: '' };
    if (days <= leadTime)     return { label: `${days}d`, color: 'text-red-700 font-bold', bg: 'bg-red-100' };
    if (days <= leadTime + 7) return { label: `${days}d`, color: 'text-amber-700 font-bold', bg: 'bg-amber-100' };
    return { label: `${days}d`, color: 'text-green-700', bg: 'bg-green-100' };
  };

  const needsReorder = products.filter(p => p.orderUrgent || p.orderSoon || (p.availableQty ?? 0) <= (p.minStock ?? 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6" /> Estoque
          </h1>
          <p className="text-sm text-gray-500 mt-1">Controle de chapas · entradas, baixas automáticas por pedido e inventário</p>
        </div>
        <button onClick={() => openEntrada()} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Nova Entrada
        </button>
      </div>

      {/* Cards resumo — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div>
            <p className="text-sm text-gray-500">Itens controlados</p>
            <p className="text-2xl font-bold text-[#1E3A5F] mt-1 font-mono">{summary.total}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-100 text-sky-700"><Package className="w-5 h-5" /></div>
        </div>

        <div className={`rounded-xl p-5 flex items-start justify-between ${summary.belowMin > 0 ? 'bg-red-50/70 border border-red-100' : 'bg-white'}`} style={{ boxShadow: 'var(--shadow-md)' }}>
          <div>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              Abaixo do mínimo
              {summary.belowMin > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </p>
            <p className={`text-2xl font-bold mt-1 font-mono ${summary.belowMin > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary.belowMin}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${summary.belowMin > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: disponível (físico - comprometido) */}
        <div className={`rounded-xl p-5 flex items-start justify-between ${summary.totalCommitted > 0 ? 'bg-amber-50/60 border border-amber-100' : 'bg-white'}`} style={{ boxShadow: 'var(--shadow-md)' }}>
          <div>
            <p className="text-sm text-gray-500">Disponível</p>
            <p className="text-2xl font-bold text-[#1E3A5F] mt-1 font-mono">
              {summary.totalAvailable} <span className="text-sm font-normal text-gray-400">un</span>
            </p>
            {summary.totalCommitted > 0
              ? <p className="text-[11px] text-amber-600 mt-0.5 font-medium">{summary.totalCommitted} un comprometidas</p>
              : <p className="text-[11px] text-gray-400 mt-0.5">{summary.totalQty} físico · sem pedidos abertos</p>
            }
          </div>
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${summary.totalCommitted > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'}`}><Boxes className="w-5 h-5" /></div>
        </div>

        {/* Novo: menor cobertura */}
        <div className={`rounded-xl p-5 flex items-start justify-between ${summary.minDays !== null && summary.minDays <= 30 ? 'bg-amber-50 border border-amber-100' : 'bg-white'}`} style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Menor cobertura</p>
            {summary.minDays !== null ? (
              <>
                <p className={`text-2xl font-bold mt-1 font-mono ${summary.minDays <= 7 ? 'text-red-600' : summary.minDays <= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                  {summary.minDays}d
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{summary.minDaysProduct}</p>
              </>
            ) : (
              <p className="text-2xl font-bold mt-1 text-gray-300">—</p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${summary.minDays !== null && summary.minDays <= 30 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Banner estoque insuficiente (overCommitted) */}
      {summary.overCommittedCount > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Estoque insuficiente — pedidos comprometidos excedem o físico</p>
            <p className="text-xs text-red-600 mt-1">
              {products.filter(p => p.overCommitted).map(p => `${p.description}: ${p.availableQty} un disponível`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Banner de sugestão de compra */}
      {needsReorder.length > 0 && (
        <div className={`border rounded-xl p-4 ${needsReorder.some(p => p.orderUrgent) ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <ShoppingCart className={`w-5 h-5 mt-0.5 flex-shrink-0 ${needsReorder.some(p => p.orderUrgent) ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${needsReorder.some(p => p.orderUrgent) ? 'text-red-800' : 'text-amber-800'}`}>
                {needsReorder.some(p => p.orderUrgent) ? '🚨 Reposição urgente — prazo do fornecedor em risco' : 'Sugestão de reposição'}
              </p>
              <div className="mt-2 space-y-1.5">
                {needsReorder.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm flex-wrap gap-1">
                    <span className={`font-medium ${p.orderUrgent ? 'text-red-900' : 'text-amber-900'}`}>{p.description}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.orderUrgent && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                          PEDIR HOJE · {p.daysRemaining}d restantes / prazo {p.leadTimeDays}d
                        </span>
                      )}
                      {p.orderSoon && !p.orderUrgent && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Pedir em breve · {p.daysRemaining}d restantes / prazo {p.leadTimeDays}d
                        </span>
                      )}
                      {p.suggestedOrder30 > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          ~{p.suggestedOrder30} un para 30 dias
                        </span>
                      )}
                      {!p.orderUrgent && !p.orderSoon && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Abaixo do mínimo ({p.availableQty} / mín. {p.minStock})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('saldo')}
          className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${tab === 'saldo' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Boxes className="w-4 h-4" /> Saldo atual
        </button>
        <button
          onClick={() => { setTab('relatorio'); if (!report) loadReport(reportMonths); }}
          className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${tab === 'relatorio' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <BarChart2 className="w-4 h-4" /> Consumo mensal
        </button>
      </div>

      {/* Aba: Saldo atual */}
      {tab === 'saldo' && <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Boxes className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>Nenhuma chapa base com controle de estoque.</p>
            <p className="text-xs mt-1">Clique em <strong>Nova Entrada</strong> para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium text-center">Saldo</th>
                  <th className="px-4 py-3 font-medium text-center">Cons./dia</th>
                  <th className="px-4 py-3 font-medium text-center">Dias</th>
                  <th className="px-4 py-3 font-medium text-center">Situação</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = !p.overCommitted && (p.availableQty ?? 0) <= (p.minStock ?? 0);
                  const ds = daysStatus(p.daysRemaining, p.leadTimeDays);
                  return (
                    <tr key={p.id} className={`border-t hover:bg-gray-50 ${p.overCommitted ? 'bg-red-100/40' : low ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1E3A5F]">{p.description}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="font-mono font-bold text-lg text-[#1E3A5F]">
                          {p.availableQty}
                          <span className="text-xs text-gray-400 font-normal ml-0.5">un</span>
                        </p>
                        {p.committedQty > 0 && (
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                            ↓{p.committedQty} comprom. · {p.stockQuantity} físico
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.dailyAvg > 0 ? (
                          <div className="text-center">
                            <p className="font-mono text-sm text-gray-700">{p.dailyAvg}</p>
                            <p className="text-[10px] text-gray-400">un/dia</p>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.daysRemaining !== null ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ds.bg} ${ds.color}`}>
                            {ds.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.overCommitted ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-200 text-red-800 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Insuficiente
                          </span>
                        ) : low || p.orderUrgent ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {p.orderUrgent ? 'Pedir já' : 'Repor'}
                          </span>
                        ) : p.orderSoon ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Pedir em breve
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <button onClick={() => openEntrada(p.id)} className="text-xs px-2.5 py-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 flex items-center gap-1">
                            <ArrowDownCircle className="w-3.5 h-3.5" /> Entrada
                          </button>
                          <button onClick={() => { setAvaria({ quantity: '', motivo: 'Defeito fornecedor', observacao: '' }); setShowAvaria(p); }} className="text-xs px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Avaria
                          </button>
                          <button onClick={() => { setAjuste({ newCount: String(p.stockQuantity ?? 0), reason: '' }); setShowAjuste(p); }} className="text-xs px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1">
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar
                          </button>
                          <button onClick={() => openHistory(p)} className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1">
                            <History className="w-3.5 h-3.5" /> Histórico
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Aba: Consumo Mensal */}
      {tab === 'relatorio' && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
          {/* Seletor de período */}
          <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/50">
            <p className="text-sm text-gray-500">Período de análise</p>
            <div className="flex gap-1">
              {([3, 6, 12] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setReportMonths(m); setReport(null); loadReport(m); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${reportMonths === m ? 'bg-[#1E3A5F] text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          {loadingReport ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !report || report.products.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <BarChart2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Nenhuma movimentação registrada ainda.</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Bloco financeiro resumido */}
              {(() => {
                const totalGasto = report.products.reduce((s, prod) =>
                  s + (report.report[prod.id] ?? []).reduce((ss, r) => ss + r.entradaCost, 0), 0);
                const totalQtyAll = products.reduce((s, p) => s + (p.stockQuantity ?? 0), 0);
                const avgCostAll = totalQtyAll > 0
                  ? products.reduce((s, p) => s + (p.avgCost ?? 0) * (p.stockQuantity ?? 0), 0) / totalQtyAll
                  : 0;
                return (
                  <div className="p-5 bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Valor em estoque</p>
                      <p className="text-xl font-bold text-[#1E3A5F] font-mono mt-1">{formatCurrency(summary.stockValue)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">saldo × custo médio atual</p>
                    </div>
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total gasto (6 meses)</p>
                      <p className="text-xl font-bold text-[#1E3A5F] font-mono mt-1">{formatCurrency(totalGasto)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">custo total das entradas</p>
                    </div>
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Custo médio atual</p>
                      <p className="text-xl font-bold text-[#1E3A5F] font-mono mt-1">
                        {avgCostAll > 0 ? formatCurrency(avgCostAll) : '—'}
                        <span className="text-xs font-normal text-gray-400 ml-1">/ chapa</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">média ponderada por saldo</p>
                    </div>
                  </div>
                );
              })()}

              {report.products.map((prod) => {
                const rows = report.report[prod.id] ?? [];
                const totalEntradas = rows.reduce((s, r) => s + r.entradaQty, 0);
                const totalCusto = rows.reduce((s, r) => s + r.entradaCost, 0);
                const totalSaidas = rows.reduce((s, r) => s + r.saidaQty, 0);
                const stockProd = products.find(p => p.id === prod.id);
                return (
                  <div key={prod.id} className="p-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-[#1E3A5F]">{prod.description}</p>
                        <p className="text-xs text-gray-400 font-mono">{prod.code}</p>
                      </div>
                      {(() => {
                        const totalAvarias = rows.reduce((s, r) => s + r.avariaQty, 0);
                        const eff = stockProd?.efficiency;
                        return (
                          <div className="flex gap-3 text-xs text-gray-500 flex-wrap items-center">
                            <span>Total 6 meses — <strong className="text-green-700">{totalEntradas} un compradas</strong></span>
                            <span><strong className="text-red-600">{totalSaidas} un consumidas</strong></span>
                            {totalAvarias > 0 && <span><strong className="text-orange-600">{totalAvarias} avarias</strong></span>}
                            {totalCusto > 0 && <span><strong className="text-gray-700">{formatCurrency(totalCusto)} gasto</strong></span>}
                            {eff !== null && eff !== undefined && (
                              <span className={`px-2 py-0.5 rounded-full font-bold ${eff >= 95 ? 'bg-green-100 text-green-700' : eff >= 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {eff}% aproveitamento
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 text-xs uppercase border-b">
                            <th className="pb-2 font-medium">Mês</th>
                            <th className="pb-2 font-medium text-center">Entradas (UN)</th>
                            <th className="pb-2 font-medium text-center">Custo NF</th>
                            <th className="pb-2 font-medium text-center">Saídas (UN)</th>
                            <th className="pb-2 font-medium text-center">Avarias</th>
                            <th className="pb-2 font-medium text-center">Custo/un médio</th>
                            <th className="pb-2 font-medium text-right">Saldo final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const avgUnit = row.entradaQty > 0 && row.entradaCost > 0
                              ? row.entradaCost / row.entradaQty : null;
                            const hasActivity = row.entradaQty > 0 || row.saidaQty > 0;
                            return (
                              <tr key={row.month} className={`border-b last:border-0 ${!hasActivity ? 'opacity-40' : ''}`}>
                                <td className="py-2.5 font-medium capitalize">{row.label}</td>
                                <td className="py-2.5 text-center">
                                  {row.entradaQty > 0
                                    ? <span className="font-mono text-green-700 font-bold">+{row.entradaQty}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-center font-mono text-sm">
                                  {row.entradaCost > 0
                                    ? <span className="text-gray-700">{formatCurrency(row.entradaCost)}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-center">
                                  {row.saidaQty > 0
                                    ? <span className="font-mono text-red-600 font-bold">−{row.saidaQty}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-center">
                                  {row.avariaQty > 0
                                    ? <span className="font-mono text-orange-600 font-bold">−{row.avariaQty}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-center font-mono text-xs text-gray-500">
                                  {avgUnit != null ? formatCurrency(avgUnit) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-right font-mono font-bold text-[#1E3A5F]">
                                  {row.balanceFinal !== null ? `${row.balanceFinal} un` : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Entrada — Fix 1: só chapas base */}
      {showEntrada && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-green-600" /> Entrada de Estoque
              </h2>
              <button onClick={() => setShowEntrada(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Chapa base *</label>
                <select value={entrada.productId} onChange={(e: any) => setEntrada({ ...entrada, productId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none bg-white">
                  <option value="">Selecione a chapa...</option>
                  {baseProducts.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.description} — saldo atual: {p.stockQuantity ?? 0} un</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Informe a quantidade conforme a Nota Fiscal.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade *</label>
                <input type="number" step="1" value={entrada.quantity} onChange={(e: any) => setEntrada({ ...entrada, quantity: e.target.value })} placeholder="Ex: 200" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Custo unitário (R$) <span className="text-gray-400 font-normal">— informe para custo médio correto</span>
                </label>
                <input type="number" step="0.01" value={entrada.unitCost} onChange={(e: any) => setEntrada({ ...entrada, unitCost: e.target.value })} placeholder="Ex: 18,50" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                {entrada.quantity && entrada.unitCost && parseFloat(entrada.quantity) > 0 && parseFloat(entrada.unitCost) > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    Total NF: {formatCurrency(parseFloat(entrada.quantity) * parseFloat(entrada.unitCost))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nota / Referência <span className="text-gray-400 font-normal">— opcional</span></label>
                <input value={entrada.reason} onChange={(e: any) => setEntrada({ ...entrada, reason: e.target.value })} placeholder="Ex: NF 528601 BLANKS" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEntrada(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={saveEntrada} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Registrar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Avaria */}
      {showAvaria && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-orange-600" /> Registrar Avaria
              </h2>
              <button onClick={() => setShowAvaria(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm border-l-4 border-orange-400">
              <p className="font-medium text-[#1E3A5F]">{showAvaria.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">Saldo atual: <strong className="font-mono">{showAvaria.stockQuantity ?? 0}</strong> un · A avaria deduz do estoque sem gerar venda</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade avariada *</label>
                <input type="number" step="1" min="1" value={avaria.quantity} onChange={(e: any) => setAvaria({ ...avaria, quantity: e.target.value })} placeholder="Ex: 2" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo *</label>
                <select value={avaria.motivo} onChange={(e: any) => setAvaria({ ...avaria, motivo: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option>Defeito fornecedor</option>
                  <option>Erro de numeração</option>
                  <option>Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observação <span className="text-gray-400 font-normal">— opcional</span></label>
                <input value={avaria.observacao} onChange={(e: any) => setAvaria({ ...avaria, observacao: e.target.value })} placeholder="Ex: placa ABC-1234, chapa amassada" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAvaria(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={saveAvaria} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Registrar Avaria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajuste */}
      {showAjuste && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" /> Ajuste de Inventário
              </h2>
              <button onClick={() => setShowAjuste(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm border-l-4 border-[#2B7DB7]">
              <p className="font-medium text-[#1E3A5F]">{showAjuste.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">Saldo atual no sistema: <strong className="font-mono">{showAjuste.stockQuantity ?? 0}</strong> un</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contagem física (saldo real) *</label>
                <input type="number" step="1" value={ajuste.newCount} onChange={(e: any) => setAjuste({ ...ajuste, newCount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                {ajuste.newCount !== '' && !isNaN(parseFloat(ajuste.newCount)) && (
                  <p className="text-xs mt-1 text-gray-500">
                    Diferença: <strong className={parseFloat(ajuste.newCount) - (showAjuste.stockQuantity ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {parseFloat(ajuste.newCount) - (showAjuste.stockQuantity ?? 0) >= 0 ? '+' : ''}
                      {parseFloat(ajuste.newCount) - (showAjuste.stockQuantity ?? 0)}
                    </strong> un
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo <span className="text-gray-400 font-normal">— opcional</span></label>
                <input value={ajuste.reason} onChange={(e: any) => setAjuste({ ...ajuste, reason: e.target.value })} placeholder="Ex: Inventário mensal / Quebra" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAjuste(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={saveAjuste} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Histórico */}
      {historyProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <History className="w-5 h-5" /> Movimentações — {historyProduct.description}
              </h2>
              <button onClick={() => setHistoryProduct(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {loadingHist ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : movements.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 text-xs uppercase">
                      <th className="pb-2">Data</th>
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Motivo</th>
                      <th className="pb-2 text-right">Qtd</th>
                      <th className="pb-2 text-right">Saldo</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m: any) => (
                      <tr key={m.id} className={`border-b last:border-0 ${m.reversed ? 'opacity-40' : ''}`}>
                        <td className="py-2 text-xs text-gray-500">{formatDateTime(m.createdAt)}</td>
                        <td className="py-2">
                          <span className={`text-xs font-bold ${movColor(m.type)}`}>{movLabel(m.type)}</span>
                          {m.reversed && <span className="ml-1 text-[10px] text-gray-400">(estornado)</span>}
                        </td>
                        <td className="py-2 text-xs">{m.reason}{m.userName ? <span className="text-gray-400"> · {m.userName}</span> : ''}</td>
                        <td className={`py-2 text-right font-mono font-bold ${movColor(m.type)}`}>{movSign(m)}</td>
                        <td className="py-2 text-right font-mono text-[#1E3A5F]">{m.balance}</td>
                        <td className="py-2 text-right">
                          {m.type === 'AVARIA' && !m.reversed && (
                            <button onClick={() => reverseAvaria(m.id)} className="text-[10px] px-2 py-0.5 rounded bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200">
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setHistoryProduct(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
