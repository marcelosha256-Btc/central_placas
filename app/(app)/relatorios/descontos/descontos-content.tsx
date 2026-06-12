'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Percent, Loader2, Filter, Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export function DescontosContent() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [userId, setUserId] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Listas para filtros
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/funcionarios').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {});
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.customers || [])).catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (userId) params.set('userId', userId);
      if (customerId) params.set('customerId', customerId);
      const res = await fetch(`/api/relatorios/descontos?${params}`);
      const data = await res.json();
      if (res.ok) {
        setDiscounts(data.discounts || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || 'Erro ao carregar relatório');
      }
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, userId, customerId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-[#1E3A5F] text-white p-2.5 rounded-xl">
          <Percent className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Descontos Concedidos</h1>
          <p className="text-sm text-gray-500">Relatório de descontos aplicados em baixas de fatura</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Funcionário</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            >
              <option value="">Todos</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            >
              <option value="">Todos</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#2B7DB7]" />
          </div>
        ) : discounts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Percent className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum desconto encontrado no período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Funcionário</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Fatura / Pedido</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Desconto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((d: any) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(d.createdAt)}</td>
                    <td className="px-4 py-3">{d.userName || '-'}</td>
                    <td className="px-4 py-3">{d.customerName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.invoiceNumber ? `Fatura ${d.invoiceNumber}` : d.orderNumber ? `Pedido #${d.orderNumber}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(d.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={d.reason}>{d.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-700">Total do período:</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 text-base">{formatCurrency(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}