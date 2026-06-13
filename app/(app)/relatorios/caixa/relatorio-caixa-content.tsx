'use client';

import { useState } from 'react';
import {
  Loader2, FileText, FileSpreadsheet, Eye, X, Search,
  DollarSign, TrendingUp, TrendingDown, Hash,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface CaixaMovement {
  id: string;
  type: string;
  amount: number;
  description: string;
  paymentMethod: string;
  createdAt: string;
}

interface CaixaRegister {
  id: string;
  openDate: string;
  closeDate: string | null;
  status: string;
  responsible: string;
  initialBalance: number;
  entradas: number;
  saidas: number;
  saldoSistema: number;
  countedBalance: number | null;
  difference: number;
  finalBalance: number;
  closingNotes: string;
  movementCount: number;
  movements: CaixaMovement[];
}

type StatusFilter = '' | 'ABERTO' | 'FECHADO';

function getTodayBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function RelatorioCaixaContent() {
  const today = getTodayBR();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CaixaRegister[]>([]);
  const [summary, setSummary] = useState({ totalRegistros: 0, totalEntradas: 0, totalSaidas: 0, saldoTotal: 0 });
  const [generated, setGenerated] = useState(false);

  const [viewRegister, setViewRegister] = useState<CaixaRegister | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingXls, setGeneratingXls] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setGenerated(false);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/relatorios/caixa?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.data ?? []);
      setSummary(json.summary ?? { totalRegistros: 0, totalEntradas: 0, totalSaidas: 0, saldoTotal: 0 });
      setGenerated(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar dados');
    }
    setLoading(false);
  };

  const getViewLabel = () => {
    const parts: string[] = [];
    if (dateFrom && dateTo && dateFrom === dateTo) {
      parts.push(`Dia ${new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR')}`);
    } else {
      if (dateFrom) parts.push(`De ${new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR')}`);
      if (dateTo) parts.push(`Até ${new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}`);
    }
    if (statusFilter === 'FECHADO') parts.push('(Fechados)');
    else if (statusFilter === 'ABERTO') parts.push('(Abertos)');
    return parts.length > 0 ? parts.join(' ') : 'Todos os Registros';
  };

  const fmtDateTime = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  };

  const statusLabel = (s: string) => {
    if (s === 'FECHADO') return { label: 'Fechado', cls: 'bg-green-100 text-green-700' };
    if (s === 'EM_CONFERENCIA') return { label: 'Em Conferência', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Aberto', cls: 'bg-blue-100 text-blue-700' };
  };

  const typeLabel = (t: string) => {
    if (t === 'ENTRADA') return { label: 'Entrada', cls: 'text-green-600' };
    if (t === 'SAIDA') return { label: 'Saída', cls: 'text-red-600' };
    if (t === 'SANGRIA') return { label: 'Sangria', cls: 'text-red-600' };
    if (t === 'SUPRIMENTO') return { label: 'Suprimento', cls: 'text-green-600' };
    if (t === 'ESTORNO') return { label: 'Estorno', cls: 'text-gray-600' };
    return { label: t, cls: 'text-gray-600' };
  };

  const downloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await fetch('/api/relatorios/caixa/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, summary, viewLabel: getViewLabel() }),
      });
      if (!res.ok) throw new Error('Falha ao gerar relatório');
      const html = await res.text();
      const w = window.open('', '_blank');
      if (!w) { toast.error('Permita pop-ups para imprimir'); setGeneratingPdf(false); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 600);
      toast.success('Relatório aberto para impressão!');
    } catch { toast.error('Erro ao gerar PDF'); }
    setGeneratingPdf(false);
  };

  const downloadXls = async () => {
    setGeneratingXls(true);
    try {
      const res = await fetch('/api/relatorios/caixa/xls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, summary, viewLabel: getViewLabel() }),
      });
      if (!res.ok) throw new Error('Falha ao gerar XLS');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_caixa_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('XLS gerado com sucesso!');
    } catch { toast.error('Erro ao gerar XLS'); }
    setGeneratingXls(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Relatório de Caixa</h1>
        <p className="text-sm text-gray-500 mt-1">Consulte o fluxo de caixa por período</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Data Final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] focus:border-transparent outline-none bg-white"
            >
              <option value="">Todos</option>
              <option value="ABERTO">Abertos</option>
              <option value="FECHADO">Fechados</option>
            </select>
          </div>
          <div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#2B7DB7]" />
          <span className="ml-2 text-sm text-gray-500">Carregando...</span>
        </div>
      )}

      {/* Cards Resumo */}
      {generated && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Hash className="w-3.5 h-3.5" /> Registros</div>
            <p className="text-2xl font-bold text-[#1E3A5F]">{summary.totalRegistros}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" /> Entradas</div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalEntradas)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-red-600 text-xs mb-1"><TrendingDown className="w-3.5 h-3.5" /> Saídas</div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalSaidas)}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Saldo</div>
            <p className={`text-2xl font-bold ${summary.saldoTotal >= 0 ? 'text-[#1E3A5F]' : 'text-red-600'}`}>{formatCurrency(summary.saldoTotal)}</p>
          </div>
        </div>
      )}

      {/* Tabela + Export */}
      {generated && !loading && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">{getViewLabel()}</h3>
            <div className="flex gap-2">
              <button onClick={downloadPdf} disabled={generatingPdf || data.length === 0} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
              </button>
              <button onClick={downloadXls} disabled={generatingXls || data.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {generatingXls ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} XLS
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs">
                  <th className="pb-3">Abertura</th>
                  <th className="pb-3">Fechamento</th>
                  <th className="pb-3">Responsável</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Saldo Ini.</th>
                  <th className="pb-3 text-right">Entradas</th>
                  <th className="pb-3 text-right">Saídas</th>
                  <th className="pb-3 text-right">Saldo</th>
                  <th className="pb-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                ) : data.map((r) => {
                  const st = statusLabel(r.status);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 text-xs">{fmtDateTime(r.openDate)}</td>
                      <td className="py-2.5 text-xs">{r.closeDate ? fmtDateTime(r.closeDate) : '-'}</td>
                      <td className="py-2.5 text-xs">{r.responsible}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs">{formatCurrency(r.initialBalance)}</td>
                      <td className="py-2.5 text-right font-mono text-xs text-green-600">{formatCurrency(r.entradas)}</td>
                      <td className="py-2.5 text-right font-mono text-xs text-red-600">{formatCurrency(r.saidas)}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatCurrency(r.saldoSistema)}</td>
                      <td className="py-2.5 text-center">
                        <button onClick={() => setViewRegister(r)} className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1 mx-auto">
                          <Eye className="w-3.5 h-3.5" /> Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#1E3A5F]">
                    <td colSpan={5} className="py-2.5 text-right font-bold text-[#1E3A5F] text-xs">TOTAIS</td>
                    <td className="py-2.5 text-right font-bold font-mono text-green-600">{formatCurrency(summary.totalEntradas)}</td>
                    <td className="py-2.5 text-right font-bold font-mono text-red-600">{formatCurrency(summary.totalSaidas)}</td>
                    <td className="py-2.5 text-right font-bold font-mono text-[#1E3A5F]">{formatCurrency(summary.saldoTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Mensagem inicial */}
      {!generated && !loading && (
        <div className="bg-white rounded-xl p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Selecione o período e clique em <strong>Buscar</strong> para gerar o relatório.</p>
        </div>
      )}

      {/* Modal Detalhes do Caixa */}
      {viewRegister && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F]">Detalhes do Caixa</h2>
              <button onClick={() => setViewRegister(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>Abertura:</strong> {fmtDateTime(viewRegister.openDate)}</p>
              <p><strong>Fechamento:</strong> {viewRegister.closeDate ? fmtDateTime(viewRegister.closeDate) : '-'}</p>
              <p><strong>Responsável:</strong> {viewRegister.responsible}</p>
              <p><strong>Saldo Inicial:</strong> {formatCurrency(viewRegister.initialBalance)}</p>
              <p><strong>Entradas:</strong> <span className="text-green-600 font-bold">{formatCurrency(viewRegister.entradas)}</span></p>
              <p><strong>Saídas:</strong> <span className="text-red-600 font-bold">{formatCurrency(viewRegister.saidas)}</span></p>
              <p><strong>Saldo Sistema:</strong> <span className="font-bold">{formatCurrency(viewRegister.saldoSistema)}</span></p>
              {viewRegister.countedBalance !== null && (
                <p><strong>Conferido:</strong> {formatCurrency(viewRegister.countedBalance)}</p>
              )}
              {viewRegister.difference !== 0 && (
                <p><strong>Diferença:</strong> <span className={viewRegister.difference >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(viewRegister.difference)}</span></p>
              )}
            </div>
            <h3 className="text-sm font-semibold text-[#1E3A5F] mb-2">Movimentações ({viewRegister.movements.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 text-xs">
                    <th className="pb-2">Hora</th>
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2">Descrição</th>
                    <th className="pb-2">Forma Pgto</th>
                    <th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {viewRegister.movements.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-400">Nenhuma movimentação.</td></tr>
                  ) : viewRegister.movements.map((m) => {
                    const tl = typeLabel(m.type);
                    return (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-xs">{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</td>
                        <td className={`py-2 text-xs font-medium ${tl.cls}`}>{tl.label}</td>
                        <td className="py-2 text-xs">{m.description}</td>
                        <td className="py-2 text-xs">{m.paymentMethod}</td>
                        <td className={`py-2 text-right font-mono ${tl.cls}`}>{formatCurrency(m.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setViewRegister(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
