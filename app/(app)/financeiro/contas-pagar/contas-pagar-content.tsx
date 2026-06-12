'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Receipt, Plus, Loader2, X, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Edit, Trash2, DollarSign, AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const EXPENSE_CATEGORIES = [
  'Aluguel',
  'Água',
  'Energia Elétrica',
  'Internet/Telefone',
  'Material de Produção',
  'Manutenção Equipamentos',
  'Salários e Encargos',
  'Impostos e Taxas',
  'Contador',
  'Combustível',
  'Material de Escritório',
  'Outros',
];

const emptyForm = {
  id: '',
  description: '',
  amount: '',
  category: 'Outros',
  supplier: '',
  dueDate: '',
  date: '',
  status: 'PENDENTE',
};

export function ContasPagarContent() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Filters
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Summary
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/expenses?page=${page}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      setExpenses(data?.expenses ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch {}
    setLoading(false);
  }, [page, dateFrom, dateTo, filterCategory, filterStatus]);

  const loadSummary = useCallback(async () => {
    try {
      let url = '/api/expenses?summary=1';
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      setSummary(data);
    } catch {}
  }, [dateFrom, dateTo, filterCategory]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleSave = async () => {
    if (!form.description || !form.amount) { toast.error('Descrição e valor obrigatórios'); return; }
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { id: form.id, description: form.description, amount: form.amount, category: form.category, supplier: form.supplier, dueDate: form.dueDate || null, date: form.date || null }
        : { description: form.description, amount: form.amount, category: form.category, supplier: form.supplier, dueDate: form.dueDate || null, date: form.date || null, status: form.status };

      const res = await fetch('/api/expenses', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success(isEdit ? 'Conta atualizada!' : 'Conta cadastrada!');
      setShowForm(false);
      setForm({ ...emptyForm });
      load();
      loadSummary();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const handlePay = async (id: string) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'pay' }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Conta paga!');
      load();
      loadSummary();
    } catch { toast.error('Erro'); }
  };

  const handleRevert = async (id: string) => {
    if (!confirm('Reverter pagamento desta conta?')) return;
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'revert' }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Pagamento revertido');
      load();
      loadSummary();
    } catch { toast.error('Erro'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta conta?')) return;
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Conta excluída');
      load();
      loadSummary();
    } catch { toast.error('Erro'); }
  };

  const handleEdit = (e: any) => {
    setForm({
      id: e.id,
      description: e.description ?? '',
      amount: String(e.amount ?? ''),
      category: e.category ?? 'Outros',
      supplier: e.supplier ?? '',
      dueDate: e.dueDate ? new Date(e.dueDate).toISOString().split('T')[0] : '',
      date: e.date ? new Date(e.date).toISOString().split('T')[0] : '',
      status: e.status ?? 'PENDENTE',
    });
    setShowForm(true);
  };

  const isOverdue = (exp: any) => {
    if (exp.status === 'PAGO') return false;
    if (!exp.dueDate) return false;
    return new Date(exp.dueDate) < new Date(new Date().toDateString());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Receipt className="w-6 h-6" /> Contas a Pagar
        </h1>
        <button onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Nova Conta
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Pendente</p>
                <p className="text-lg font-bold text-amber-600 font-mono">{formatCurrency(summary.totalPendente)}</p>
                <p className="text-xs text-gray-400">{summary.countPendente} conta(s)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Pago</p>
                <p className="text-lg font-bold text-green-600 font-mono">{formatCurrency(summary.totalPago)}</p>
                <p className="text-xs text-gray-400">{summary.countPago} conta(s)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Total Geral</p>
                <p className="text-lg font-bold text-[#1E3A5F] font-mono">{formatCurrency((summary.totalPendente ?? 0) + (summary.totalPago ?? 0))}</p>
                <p className="text-xs text-gray-400">{(summary.countPendente ?? 0) + (summary.countPago ?? 0)} conta(s)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">De</label>
          <input type="date" value={dateFrom} onChange={(e: any) => { setDateFrom(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Até</label>
          <input type="date" value={dateTo} onChange={(e: any) => { setDateTo(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Categoria</label>
          <select value={filterCategory} onChange={(e: any) => { setFilterCategory(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none bg-white min-w-[160px]">
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={filterStatus} onChange={(e: any) => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none bg-white min-w-[130px]">
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGO">Pago</option>
          </select>
        </div>
        {(dateFrom || dateTo || filterCategory || filterStatus) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterCategory(''); setFilterStatus(''); setPage(1); }} className="text-sm text-gray-500 hover:text-red-500 underline pb-2">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(expenses ?? [])?.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Nenhuma conta encontrada</td></tr>
                )}
                {(expenses ?? [])?.map((e: any) => (
                  <tr key={e?.id} className={`border-t hover:bg-gray-50 ${isOverdue(e) ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOverdue(e) && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className={isOverdue(e) ? 'text-red-700 font-medium' : ''}>{e?.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{e?.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{e?.supplier || '-'}</td>
                    <td className="px-4 py-3 font-mono text-red-600 font-medium">{formatCurrency(e?.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {e?.dueDate ? formatDate(e.dueDate) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {e?.status === 'PAGO' ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          isOverdue(e) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Clock className="w-3 h-3" /> {isOverdue(e) ? 'Vencida' : 'Pendente'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {e?.status === 'PENDENTE' && (
                          <button onClick={() => handlePay(e.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Marcar como pago">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {e?.status === 'PAGO' && (
                          <button onClick={() => handleRevert(e.id)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600" title="Reverter pagamento">
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleEdit(e)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">{form.id ? 'Editar Conta' : 'Nova Conta a Pagar'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Descrição *</label>
                <input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" placeholder="Ex: Aluguel janeiro/2025" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <select value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none bg-white">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fornecedor</label>
                <input value={form.supplier} onChange={(e: any) => setForm({ ...form, supplier: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" placeholder="Opcional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Data de Lançamento</label>
                  <input type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vencimento</label>
                  <input type="date" value={form.dueDate} onChange={(e: any) => setForm({ ...form, dueDate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                </div>
              </div>
              {!form.id && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expStatus"
                      checked={form.status === 'PENDENTE'}
                      onChange={() => setForm({ ...form, status: 'PENDENTE' })}
                      className="text-[#2B7DB7] focus:ring-[#2B7DB7]"
                    />
                    <span className="text-sm">Pendente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expStatus"
                      checked={form.status === 'PAGO'}
                      onChange={() => setForm({ ...form, status: 'PAGO' })}
                      className="text-[#2B7DB7] focus:ring-[#2B7DB7]"
                    />
                    <span className="text-sm">Já pago</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
