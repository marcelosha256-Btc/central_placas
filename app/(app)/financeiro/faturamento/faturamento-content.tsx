'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Send, Eye, XCircle, CheckCircle, ChevronDown, Download, X, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Transferência', 'Boleto'];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  GERADA: { label: 'Gerada', className: 'bg-gray-100 text-gray-700' },
  ENVIADA: { label: 'Enviada', className: 'bg-blue-100 text-blue-700' },
  PARCIAL: { label: 'Parcial', className: 'bg-yellow-100 text-yellow-800' },
  PAGA: { label: 'Paga', className: 'bg-green-100 text-green-700' },
  VENCIDA: { label: 'Vencida', className: 'bg-red-100 text-red-700' },
  CANCELADA: { label: 'Cancelada', className: 'bg-gray-200 text-gray-500' },
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  AVISTA: 'À Vista',
  D15: 'D+15',
  D30: 'D+30',
};

function getMonthName(m: number) {
  return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || '';
}

export function FaturamentoContent() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Modal de baixa de pagamento
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('PIX');
  const [payDiscount, setPayDiscount] = useState('');
  const [payDiscountReason, setPayDiscountReason] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('month', String(month));
      params.set('year', String(year));
      if (statusFilter !== 'TODAS') params.set('status', statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.data || []);
        setSummary(data.summary || null);
      }
    } catch (e) {
      console.error('Erro ao buscar faturas:', e);
    } finally {
      setLoading(false);
    }
  }, [month, year, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleGenerate = async () => {
    if (!confirm(`Gerar/recalcular faturas de ${getMonthName(month)}/${year} para todos os clientes frota?`)) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Faturas geradas com sucesso!');
        fetchInvoices();
      } else {
        alert(data.error || 'Erro ao gerar faturas');
      }
    } catch (e) {
      alert('Erro ao gerar faturas');
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (invoiceId: string, action: string, cancelReason?: string) => {
    setActionLoading(invoiceId);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, action, cancelReason }),
      });
      if (res.ok) {
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao atualizar fatura');
      }
    } catch (e) {
      alert('Erro ao atualizar fatura');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadInvoicePdf = async (inv: any) => {
    setPdfLoading(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`);
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const html = await res.text();
      const w = window.open('', '_blank');
      if (!w) { alert('Permita pop-ups para imprimir'); setPdfLoading(null); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 600);
    } catch {
      alert('Erro ao gerar PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  const openPayModal = (inv: any) => {
    const openAmount = Math.max(0, (inv.amountDue ?? 0) - (inv.amountReceived ?? 0));
    setPayInvoice(inv);
    setPayAmount(openAmount.toFixed(2));
    setPayMethod('PIX');
    setPayDiscount('');
    setPayDiscountReason('');
  };

  const handleRegisterPayment = async () => {
    if (!payInvoice) return;
    const amount = parseFloat(payAmount.replace(',', '.'));
    const discount = payDiscount ? parseFloat(payDiscount.replace(',', '.')) : 0;
    if ((!amount || amount <= 0) && (!discount || discount <= 0)) {
      alert('Informe um valor recebido ou desconto maior que zero');
      return;
    }
    if (discount > 0 && !payDiscountReason.trim()) {
      alert('Informe o motivo do desconto');
      return;
    }
    const openBalance = Math.max(0, (payInvoice.amountDue ?? 0) - (payInvoice.amountReceived ?? 0));
    if ((amount + discount) > openBalance + 0.01) {
      alert('Valor recebido + desconto não pode ultrapassar o saldo em aberto');
      return;
    }
    setPaySubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payInvoice.id,
          action: 'registerPayment',
          amount: amount || 0,
          paymentMethod: payMethod,
          discount: discount || 0,
          discountReason: payDiscountReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPayInvoice(null);
        fetchInvoices();
      } else {
        alert(data.error || 'Erro ao registrar pagamento');
      }
    } catch (e) {
      alert('Erro ao registrar pagamento');
    } finally {
      setPaySubmitting(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Faturamento
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gere e gerencie faturas mensais dos clientes frota</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
        >
          {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {generating ? 'Gerando...' : 'Gerar Faturas'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Mês:</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Ano:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            >
              <option value="TODAS">Todas</option>
              <option value="GERADA">Gerada</option>
              <option value="ENVIADA">Enviada</option>
              <option value="PARCIAL">Parcial</option>
              <option value="PAGA">Paga</option>
              <option value="VENCIDA">Vencida</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="text-sm text-[#2B7DB7] hover:text-[#1E3A5F] flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="Faturas" value={String(summary.total)} />
          <SummaryCard label="Serviços" value={formatCurrency(summary.totalServicos)} color="text-gray-800" />
          <SummaryCard label="Saldo Anterior" value={formatCurrency(summary.totalSaldoAnterior)} color="text-orange-600" />
          <SummaryCard label="Total Devido" value={formatCurrency(summary.totalDevido)} color="text-[#1E3A5F]" />
          <SummaryCard label="Recebido" value={formatCurrency(summary.totalRecebido)} color="text-green-600" />
          <SummaryCard label="Em Aberto" value={formatCurrency(summary.totalAberto)} color="text-red-600" />
        </div>
      )}

      {/* Status chips */}
      {summary?.porStatus && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.porStatus).map(([st, count]) => {
            if (!(count as number)) return null;
            const badge = STATUS_BADGES[st];
            return (
              <span key={st} className={`px-3 py-1 rounded-full text-xs font-medium ${badge?.className || 'bg-gray-100 text-gray-600'}`}>
                {badge?.label || st}: {count as number}
              </span>
            );
          })}
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-[#2B7DB7]" />
            Carregando faturas...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nenhuma fatura encontrada</p>
            <p className="text-sm mt-1">Clique em "Gerar Faturas" para criar as faturas de {getMonthName(month)}/{year}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nº</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Prazo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Pedidos</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Placas</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Serviços</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo Ant.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Recebido</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Vencimento</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const badge = STATUS_BADGES[inv.derivedStatus] || STATUS_BADGES['GERADA'];
                  const openAmount = Math.max(0, (inv.amountDue ?? 0) - (inv.amountReceived ?? 0));
                  const isExpanded = expandedId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className="border-b hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.customer?.name}</div>
                        {inv.customer?.document && (
                          <div className="text-xs text-gray-400">{inv.customer.document}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                          {PAYMENT_TERM_LABELS[inv.customer?.paymentTerm] || 'À Vista'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{inv.orderCount}</td>
                      <td className="px-4 py-3 text-center font-medium">{inv.plateCount}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(inv.servicesTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        {inv.previousBalance > 0 ? (
                          <span className="text-orange-600 font-medium">{formatCurrency(inv.previousBalance)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">{formatCurrency(inv.amountDue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={inv.amountReceived > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {inv.amountReceived > 0 ? formatCurrency(inv.amountReceived) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => downloadInvoicePdf(inv)}
                            disabled={pdfLoading === inv.id}
                            title="Gerar PDF do extrato"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            {pdfLoading === inv.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          </button>
                          {inv.derivedStatus === 'GERADA' && (
                            <button
                              onClick={() => handleAction(inv.id, 'markSent')}
                              disabled={actionLoading === inv.id}
                              title="Marcar como Enviada"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}
                          {(inv.derivedStatus === 'ENVIADA' || inv.derivedStatus === 'PARCIAL' || inv.derivedStatus === 'VENCIDA' || inv.derivedStatus === 'GERADA' || (inv.derivedStatus === 'PAGA' && openAmount > 0.01)) && (
                            <button
                              onClick={() => openPayModal(inv)}
                              disabled={actionLoading === inv.id}
                              title="Registrar Pagamento (baixa)"
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          {inv.derivedStatus !== 'CANCELADA' && inv.derivedStatus !== 'PAGA' && (
                            <button
                              onClick={() => {
                                const reason = prompt('Motivo do cancelamento (opcional):');
                                if (reason !== null) handleAction(inv.id, 'cancel', reason);
                              }}
                              disabled={actionLoading === inv.id}
                              title="Cancelar Fatura"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals footer */}
      {invoices.length > 0 && summary && (
        <div className="bg-[#1E3A5F]/5 rounded-xl p-4 border border-[#1E3A5F]/10">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total Devido:</span>{' '}
              <span className="font-bold text-[#1E3A5F]">{formatCurrency(summary.totalDevido)}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Recebido:</span>{' '}
              <span className="font-bold text-green-600">{formatCurrency(summary.totalRecebido)}</span>
            </div>
            <div>
              <span className="text-gray-500">Em Aberto:</span>{' '}
              <span className="font-bold text-red-600">{formatCurrency(summary.totalAberto)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de baixa de pagamento */}
      {payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !paySubmitting && setPayInvoice(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Registrar pagamento
              </h2>
              <button onClick={() => setPayInvoice(null)} disabled={paySubmitting} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="font-medium text-gray-900">{payInvoice.customer?.name}</div>
                <div className="text-xs text-gray-400 font-mono">Fatura {payInvoice.number}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[11px] text-gray-500">Total devido</div>
                  <div className="text-sm font-bold text-[#1E3A5F]">{formatCurrency(payInvoice.amountDue)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[11px] text-gray-500">Recebido</div>
                  <div className="text-sm font-bold text-green-600">{formatCurrency(payInvoice.amountReceived ?? 0)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[11px] text-gray-500">Em aberto</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(Math.max(0, (payInvoice.amountDue ?? 0) - (payInvoice.amountReceived ?? 0)))}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Valor recebido</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                  placeholder="0,00"
                />
                <p className="text-[11px] text-gray-400 mt-1">Para pagamento parcial, ajuste o valor (já vem preenchido com o total em aberto).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Forma de pagamento</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Desconto (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payDiscount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPayDiscount(val);
                    const dv = val ? parseFloat(val.replace(',', '.')) : 0;
                    const openBal = Math.max(0, (payInvoice?.amountDue ?? 0) - (payInvoice?.amountReceived ?? 0));
                    setPayAmount(Math.max(0, openBal - (dv || 0)).toFixed(2));
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                  placeholder="0,00"
                />
                <p className="text-[11px] text-gray-400 mt-1">Opcional. O desconto não entra no caixa, apenas abate o saldo da fatura.</p>
              </div>

              {(parseFloat((payDiscount || '0').replace(',', '.')) > 0) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Motivo do desconto <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={payDiscountReason}
                    onChange={(e) => setPayDiscountReason(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="Ex: desconto fidelidade, acordo comercial..."
                  />
                </div>
              )}

              <p className="text-xs text-gray-500">Data do pagamento: <b>hoje ({formatDate(new Date().toISOString())})</b></p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <button onClick={() => setPayInvoice(null)} disabled={paySubmitting} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button
                onClick={handleRegisterPayment}
                disabled={paySubmitting}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {paySubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
