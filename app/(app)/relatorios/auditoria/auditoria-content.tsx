'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Shield, Loader2, X, ChevronLeft, ChevronRight,
  Eye, FileText, Trash2, Edit, DollarSign, Filter,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  ALTERACAO: 'Alteração',
  EXCLUSAO: 'Exclusão',
  RECEBIMENTO: 'Recebimento',
};

const ACTION_COLORS: Record<string, string> = {
  ALTERACAO: 'bg-yellow-100 text-yellow-800',
  EXCLUSAO: 'bg-red-100 text-red-800',
  RECEBIMENTO: 'bg-green-100 text-green-800',
};

const ACTION_ICONS: Record<string, any> = {
  ALTERACAO: Edit,
  EXCLUSAO: Trash2,
  RECEBIMENTO: DollarSign,
};

export function AuditoriaContent() {
  const [audits, setAudits] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [action, setAction] = useState('');

  // Detail modal
  const [viewAudit, setViewAudit] = useState<any>(null);

  // Users for filter
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    fetch('/api/funcionarios')
      .then(r => r.json())
      .then(d => setUsers(d?.users ?? []))
      .catch(() => {});
  }, []);

  const loadAudits = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/relatorios/auditoria?page=${page}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (selectedUser) url += `&userId=${selectedUser}`;
      if (orderNumber) url += `&orderNumber=${orderNumber}`;
      if (action) url += `&action=${action}`;

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error || 'Erro ao carregar auditoria');
        setAudits([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAudits(data?.audits ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch {
      toast.error('Erro ao carregar auditoria');
    }
    setLoading(false);
  }, [page, dateFrom, dateTo, selectedUser, orderNumber, action]);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedUser('');
    setOrderNumber('');
    setAction('');
    setPage(1);
  };

  const hasFilters = dateFrom || dateTo || selectedUser || orderNumber || action;

  const parsePreviousData = (data: string | null) => {
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6" /> Auditoria de Pedidos
        </h1>
        <p className="text-sm text-gray-500 mt-1">{total} registros de auditoria</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[#1E3A5F]">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Funcionário</label>
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none min-w-[160px]"
            >
              <option value="">Todos</option>
              {users.map((u: any) => (
                <option key={u?.id} value={u?.id}>{u?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº Pedido</label>
            <input
              type="number"
              value={orderNumber}
              onChange={(e) => { setOrderNumber(e.target.value); setPage(1); }}
              placeholder="Ex: 123"
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none w-28"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de Ação</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none min-w-[140px]"
            >
              <option value="">Todas</option>
              <option value="ALTERACAO">Alteração</option>
              <option value="EXCLUSAO">Exclusão</option>
            </select>
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 px-3 py-2"
              >
                <X className="w-4 h-4" /> Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Data/Hora</th>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Funcionário</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Nenhum registro de auditoria encontrado
                    </td>
                  </tr>
                )}
                {audits.map((a: any) => {
                  const ActionIcon = ACTION_ICONS[a.action] || FileText;
                  return (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateTime(a.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        #{a.order?.orderNumber ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {a.order?.customer?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[a.action] ?? 'bg-gray-100 text-gray-700'}`}>
                          <ActionIcon className="w-3 h-3" />
                          {ACTION_LABELS[a.action] ?? a.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{a.userName ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={a.reason || ''}>
                        {a.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewAudit(a)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                          title="Ver dados anteriores"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewAudit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">
                Detalhes da Auditoria
              </h2>
              <button onClick={() => setViewAudit(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pedido:</span>
                <span className="font-mono font-medium">#{viewAudit.order?.orderNumber ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium">{viewAudit.order?.customer?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ação:</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[viewAudit.action] ?? ''}`}>
                  {ACTION_LABELS[viewAudit.action] ?? viewAudit.action}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Funcionário:</span>
                <span>{viewAudit.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data/Hora:</span>
                <span>{formatDateTime(viewAudit.createdAt)}</span>
              </div>
              {viewAudit.reason && (
                <div>
                  <span className="text-gray-500 block mb-1">Motivo:</span>
                  <p className="bg-gray-50 rounded-lg p-3 text-sm">{viewAudit.reason}</p>
                </div>
              )}
            </div>

            {/* Previous Data */}
            {viewAudit.previousData && (() => {
              const data = parsePreviousData(viewAudit.previousData);
              if (!data) return null;
              return (
                <div className="border-t mt-4 pt-4">
                  <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Dados Anteriores (Snapshot)</h4>
                  <div className="space-y-2 text-sm">
                    {data.orderNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Nº Pedido:</span>
                        <span className="font-mono">#{data.orderNumber}</span>
                      </div>
                    )}
                    {data.totalAmount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-mono">{formatCurrency(data.totalAmount)}</span>
                      </div>
                    )}
                    {data.paidAmount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pago:</span>
                        <span className="font-mono text-green-600">{formatCurrency(data.paidAmount)}</span>
                      </div>
                    )}
                    {data.status && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span>{data.status}</span>
                      </div>
                    )}
                    {data.notes !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Obs:</span>
                        <span>{data.notes || '-'}</span>
                      </div>
                    )}
                    {data.items && data.items.length > 0 && (
                      <div className="mt-2">
                        <span className="text-gray-500 block mb-1">Itens:</span>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {data.items.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span>
                                <span className="font-mono text-sm font-bold text-[#1E3A5F]">{it.plateNumber || '-'}</span>
                                <span className="ml-2 text-gray-600">{it.description || it.product?.description || ''}</span>
                              </span>
                              <span className="font-mono">{formatCurrency(it.unitPrice ?? it.totalPrice ?? 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewAudit(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
