'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Clock, Loader2, Search, Eye, X, Filter, DollarSign, FileText, FileSpreadsheet } from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate, PAYMENT_LABELS } from '@/lib/utils';
import { PaymentFormModal } from '@/components/payment-form-modal';

interface PaymentInfo {
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

interface OrderItem {
  plateNumber: string;
  product: string;
  unitPrice: number;
  quantity: number;
}

interface OrderDetail {
  id: string;
  orderNumber: number;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  createdAt: string;
  items: OrderItem[];
  payments: PaymentInfo[];
}

interface ClientGroup {
  customerId: string;
  customerName: string;
  monthlyReport?: boolean;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  orderCount: number;
  orders: OrderDetail[];
}

export function ContasReceberContent() {
  const [clients, setClients] = useState<ClientGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [totalRestante, setTotalRestante] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showPayment, setShowPayment] = useState<any>(null);
  const [viewClient, setViewClient] = useState<ClientGroup | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'xls' | null>(null);

  // Filtros
  const [clienteId, setClienteId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scope, setScope] = useState<'balcao' | 'frota' | 'todos'>('todos');
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/customers?all=1').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : d?.customers ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Informe a Data Inicial e Data Final');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clienteId) params.set('customerId', clienteId);
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      params.set('scope', scope);
      const res = await fetch(`/api/receivables?${params}`);
      const data = await res.json();
      setClients(data?.clients ?? []);
      setTotal(data?.total ?? 0);
      setTotalRestante(data?.totalRestante ?? 0);
      setSearched(true);
    } catch {}
    setLoading(false);
  }, [clienteId, dateFrom, dateTo, scope]);

  const [bulkPayment, setBulkPayment] = useState<{ client: ClientGroup } | null>(null);

  const openPayment = (order: OrderDetail, customerName: string) => {
    setShowPayment({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      remaining: order.remaining,
    });
  };

  const downloadExport = async (type: 'pdf' | 'xls') => {
    if (clients.length === 0) { toast.error('Nenhum dado para exportar'); return; }
    setExporting(type);
    try {
      const res = await fetch(`/api/receivables/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients,
          dateFrom: dateFrom ? new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
          dateTo: dateTo ? new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
          totalRestante,
        }),
      });
      if (!res.ok) { toast.error('Erro ao gerar arquivo'); setExporting(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contas_receber.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} gerado com sucesso!`);
    } catch { toast.error('Erro ao exportar'); }
    setExporting(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6" /> Contas a Receber
        </h1>
        {searched && <p className="text-sm text-gray-500 mt-1">Clientes com saldo pendente &mdash; {total} cliente(s) &mdash; Total: <span className="font-bold text-red-600">{formatCurrency(totalRestante)}</span></p>}
      </div>

      {/* Banner: explica a separação balcão x frota */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-[#1E3A5F] flex items-start gap-2">
        <FileText className="w-4 h-4 mt-0.5 shrink-0" />
        {scope === 'balcao' ? (
          <span>Mostrando <strong>pedidos de balcão</strong>. Clientes <strong>frota</strong> são cobrados por fatura mensal — gerencie e receba em <a href="/financeiro/faturamento" className="underline font-medium">Faturamento</a>.</span>
        ) : (
          <span>Clientes <strong>frota</strong> são cobrados por fatura mensal — o ideal é receber em <a href="/financeiro/faturamento" className="underline font-medium">Faturamento</a>, onde há vencimento e status. O recebimento (aqui ou lá) lança no caixa.</span>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-sm font-semibold text-[#1E3A5F] mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Tipo</label>
            <select value={scope} onChange={e => setScope(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
              <option value="balcao">Balcão</option>
              <option value="frota">Frota</option>
              <option value="todos">Todos</option>
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
            <label className="block text-xs font-medium mb-1">Data Inicial <span className="text-red-500">*</span></label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Data Final <span className="text-red-500">*</span></label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" required />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => load()} className="flex-1 bg-[#2B7DB7] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Export buttons + Tabela */}
      {!searched && !loading ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Informe a <strong>Data Inicial</strong> e <strong>Data Final</strong> e clique em <strong>Buscar</strong>.</p>
        </div>
      ) : (
      <>
        {/* Botões de exportação */}
        {searched && clients.length > 0 && (
          <div className="flex gap-3">
            <button onClick={() => downloadExport('pdf')} disabled={exporting === 'pdf'} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Exportar PDF
            </button>
            <button onClick={() => downloadExport('xls')} disabled={exporting === 'xls'} className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
              {exporting === 'xls' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Exportar XLS
            </button>
          </div>
        )}

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-center">Pedidos</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Restante</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Nenhuma conta a receber</td></tr>
                )}
                {clients.map((c) => (
                  <tr key={c.customerId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#1E3A5F]">{c.customerName}</td>
                    <td className="px-4 py-3 text-center font-mono">{c.orderCount}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(c.totalAmount)}</td>
                    <td className="px-4 py-3 font-mono text-green-600">{formatCurrency(c.paidAmount)}</td>
                    <td className="px-4 py-3 font-mono text-red-600 font-bold">{formatCurrency(c.remaining)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {c.monthlyReport ? (
                          <a href="/financeiro/faturamento" className="text-xs px-2.5 py-1.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors flex items-center gap-1" title="Cliente frota — receber via Faturamento">
                            <FileText className="w-3.5 h-3.5" /> Faturamento
                          </a>
                        ) : (
                          <button onClick={() => setBulkPayment({ client: c })} className="text-xs px-2.5 py-1.5 rounded-md bg-green-100 hover:bg-green-200 text-green-700 transition-colors flex items-center gap-1" title="Receber">
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => setViewClient(c)} className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1" title="Ver pedidos e placas">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {clients.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#1E3A5F] bg-gray-50">
                    <td className="px-4 py-3 font-bold text-[#1E3A5F]">TOTAL</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{clients.reduce((a, c) => a + c.orderCount, 0)}</td>
                    <td className="px-4 py-3 font-mono font-bold">{formatCurrency(clients.reduce((a, c) => a + c.totalAmount, 0))}</td>
                    <td className="px-4 py-3 font-mono font-bold text-green-600">{formatCurrency(clients.reduce((a, c) => a + c.paidAmount, 0))}</td>
                    <td className="px-4 py-3 font-mono font-bold text-red-600">{formatCurrency(totalRestante)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Modal Ver Pedidos do Cliente */}
      {viewClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F]">{viewClient.customerName}</h2>
              <button onClick={() => setViewClient(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
              <p><strong>Pedidos:</strong> {viewClient.orderCount} | <strong>Total:</strong> {formatCurrency(viewClient.totalAmount)} | <strong>Pago:</strong> <span className="text-green-600">{formatCurrency(viewClient.paidAmount)}</span> | <strong>Restante:</strong> <span className="text-red-600 font-bold">{formatCurrency(viewClient.remaining)}</span></p>
            </div>

            {viewClient.orders.map((order) => (
              <div key={order.id} className="mb-4 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono font-bold text-[#1E3A5F]">#{order.orderNumber}</span>
                    <span className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</span>
                    <span className="font-mono text-red-600 font-bold">{formatCurrency(order.remaining)}</span>
                  </div>
                  <button
                    onClick={() => openPayment(order, viewClient.customerName)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    Receber
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs border-b">
                      <th className="px-4 py-2">Placa</th>
                      <th className="px-4 py-2">Produto</th>
                      <th className="px-4 py-2 text-center">Qtd</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items ?? []).map((it, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-base font-bold text-[#1E3A5F] tracking-wide">{it.plateNumber}</td>
                        <td className="px-4 py-2 text-xs">{it.product}</td>
                        <td className="px-4 py-2 text-center">{it.quantity}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagamentos realizados */}
                {(order.payments ?? []).length > 0 && (
                  <div className="bg-green-50 px-4 py-2 border-t">
                    <p className="text-xs font-semibold text-green-700 mb-0.5">Pagamentos realizados:</p>
                    <p className="text-xs text-[#1E3A5F] mb-1">Placas: <span className="font-mono font-bold tracking-wide">{(order.items ?? []).map((it: any) => it.plateNumber).filter((p: string) => p && p !== '-').join(', ') || '-'}</span></p>
                    {order.payments.map((p, pi) => (
                      <p key={pi} className="text-xs text-green-600">
                        {formatCurrency(p.amount)} — {(PAYMENT_LABELS as any)[p.paymentMethod] || p.paymentMethod} — <span className="text-gray-500">{formatDateTime(p.createdAt)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end mt-2">
              <button onClick={() => setViewClient(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (single order from detail view) */}
      {showPayment && (
        <PaymentFormModal
          order={showPayment}
          onClose={() => setShowPayment(null)}
          onSuccess={() => { load(); setViewClient(null); }}
        />
      )}

      {/* Bulk Payment Modal (all orders of a client) */}
      {bulkPayment && (
        <PaymentFormModal
          order={{
            id: bulkPayment.client.orders[0]?.id ?? '',
            customerName: bulkPayment.client.customerName,
            totalAmount: bulkPayment.client.totalAmount,
            paidAmount: bulkPayment.client.paidAmount,
            remaining: bulkPayment.client.remaining,
          }}
          bulkOrderIds={bulkPayment.client.orders.filter(o => o.remaining > 0.01).map(o => o.id)}
          bulkLabel={`Receber Todos - ${bulkPayment.client.customerName}`}
          onClose={() => setBulkPayment(null)}
          onSuccess={() => { load(); setBulkPayment(null); }}
        />
      )}
    </div>
  );
}
