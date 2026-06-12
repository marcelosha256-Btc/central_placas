'use client';

import { useState, useEffect } from 'react';
import {
  Search, Loader2, FileText, FileSpreadsheet, Filter,
  Users, Hash, DollarSign, Eye, X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
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
  paymentMethod: string;
}

export function RelatorioClientesContent() {
  const [loading, setLoading] = useState(false);
  const [placas, setPlacas] = useState<PlacaItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [generated, setGenerated] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingXls, setGeneratingXls] = useState(false);

  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(first.toISOString().slice(0, 10));
    setDateTo(last.toISOString().slice(0, 10));
    fetch('/api/customers?all=1').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : d?.customers ?? [])).catch(() => {});
  }, []);

  const handleBuscar = async () => {
    if (!clienteId) { toast.error('Selecione um cliente'); return; }
    if (!dateFrom || !dateTo) { toast.error('Informe o período'); return; }

    setLoading(true);
    setGenerated(false);
    try {
      const params = new URLSearchParams({ customerId: clienteId, dateFrom, dateTo });
      const res = await fetch(`/api/relatorios/clientes?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlacas(json.placas ?? []);
      setOrders(json.orders ?? []);
      setCustomer(json.customer ?? null);
      setSummary(json.summary ?? null);
      setGenerated(true);
      toast.success(`${json.placas?.length ?? 0} placa(s) encontrada(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar');
    }
    setLoading(false);
  };

  const formatPeriod = () => {
    if (!dateFrom || !dateTo) return '';
    return `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  };

  const downloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await fetch('/api/relatorios/clientes/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer?.name || '',
          periodStart: new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR'),
          periodEnd: new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR'),
          placas,
          orders,
          summary,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_cliente_${(customer?.name || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
    setGeneratingPdf(false);
  };

  const downloadXls = async () => {
    setGeneratingXls(true);
    try {
      const res = await fetch('/api/relatorios/clientes/xls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer?.name || '',
          periodStart: new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR'),
          periodEnd: new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR'),
          placas,
          summary,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar XLS');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_cliente_${(customer?.name || '').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('XLS gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar XLS');
    }
    setGeneratingXls(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Relatório de Clientes</h1>
        <p className="text-sm text-gray-500 mt-1">Consulte todas as placas de um cliente em um período específico</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-sm font-semibold text-[#1E3A5F] mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
              <option value="">Selecione...</option>
              {(customers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Data Inicial</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Data Final</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
          </div>
          <div className="flex items-end">
            <button onClick={handleBuscar} disabled={loading} className="w-full bg-[#2B7DB7] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Cards Resumo */}
      {generated && summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users className="w-3.5 h-3.5" /> Cliente</div>
            <p className="text-lg font-bold text-[#1E3A5F] truncate">{customer?.name || '-'}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Hash className="w-3.5 h-3.5" /> Placas</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalPlacas}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Total Geral</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{formatCurrency(summary.totalGeral)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Pago</div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPago)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Em Aberto</div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalAberto)}</p>
          </div>
        </div>
      )}

      {/* Tabela + Export */}
      {generated && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1E3A5F]">Placas de {customer?.name}</h3>
              <p className="text-xs text-gray-500">Período: {formatPeriod()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadPdf} disabled={generatingPdf || placas.length === 0} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
              </button>
              <button onClick={downloadXls} disabled={generatingXls || placas.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {generatingXls ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} XLS
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs">
                  <th className="pb-3">Data</th>
                  <th className="pb-3">Pedido</th>
                  <th className="pb-3">Placa</th>
                  <th className="pb-3">Produto</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {placas.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhuma placa encontrada no período.</td></tr>
                ) : placas.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5 text-xs">{p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="py-2.5 text-xs">#{p.orderNumber}</td>
                    <td className="py-2.5 font-mono text-base font-bold text-[#1E3A5F] tracking-wide">{p.plateNumber}</td>
                    <td className="py-2.5 text-xs">{p.product}</td>
                    <td className="py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'Pago' ? 'bg-green-100 text-green-700' : p.status === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(p.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              {placas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#1E3A5F]">
                    <td colSpan={5} className="py-2.5 text-right font-bold text-[#1E3A5F]">TOTAL EM ABERTO</td>
                    <td className="py-2.5 text-right font-bold font-mono text-red-600">{formatCurrency(summary?.totalAberto ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}