'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  ShoppingCart, Plus, Loader2, X, ChevronLeft, ChevronRight, Search,
  Eye, Trash2, Edit, DollarSign, Save, Copy,
} from 'lucide-react';
import { formatCurrency, formatDateTime, maskPlate, validatePlate, STATUS_LABELS, STATUS_COLORS, PAYMENT_LABELS } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { PaymentFormModal } from '@/components/payment-form-modal';

export function PedidosContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams?.get('novo') === '1');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchPlate, setSearchPlate] = useState('');

  // Form state
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editOrderPaid, setEditOrderPaid] = useState(0);
  const [editOrderStatus, setEditOrderStatus] = useState('');
  const [editOrderTotal, setEditOrderTotal] = useState(0);
  const [editOrderPaymentsSum, setEditOrderPaymentsSum] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemProduct, setItemProduct] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemPlate, setItemPlate] = useState('');
  const plateInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Verificação de placa duplicada no sistema
  const [plateWarning, setPlateWarning] = useState<{orderNumber: number, customer: string} | null>(null);
  const [plateChecking, setPlateChecking] = useState(false);

  // Detail
  const [viewOrder, setViewOrder] = useState<any>(null);

  // Receber modal
  const [showReceive, setShowReceive] = useState<any>(null);

  // Delete modal
  const [showDelete, setShowDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/orders?page=${page}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterDate) url += `&dateFrom=${filterDate}&dateTo=${filterDate}`;
      if (searchPlate) url += `&plate=${encodeURIComponent(searchPlate)}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data?.orders ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch { toast.error('Erro ao carregar pedidos'); }
    setLoading(false);
  }, [page, filterStatus, filterDate, searchPlate]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    fetch('/api/customers?all=1').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/products?all=1').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Verificar placa duplicada no sistema (debounce 600ms)
  useEffect(() => {
    const clean = itemPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 7) { setPlateWarning(null); return; }
    setPlateChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orders?plate=${clean}`);
        const data = await res.json();
        const found = (data?.orders ?? []).filter((o: any) => o.id !== editOrderId);
        if (found.length > 0) {
          const last = found[0];
          setPlateWarning({ orderNumber: last.orderNumber, customer: last.customer?.name ?? '' });
        } else {
          setPlateWarning(null);
        }
      } catch { setPlateWarning(null); }
      setPlateChecking(false);
    }, 600);
    return () => { clearTimeout(timer); setPlateChecking(false); };
  }, [itemPlate, editOrderId]);

  // Ordenação de produtos: produtos prioritários no topo
  const PRODUCT_PRIORITY = ['PAR CARRO', 'MOTO', 'DIANT CARRO', 'TRAS CARRO', 'PAR MINI', 'DIANT MINI', 'TRAS MINI'];
  const sortedProducts = [...(products ?? [])].sort((a: any, b: any) => {
    const dA = (a.description ?? '').toUpperCase();
    const dB = (b.description ?? '').toUpperCase();
    const iA = PRODUCT_PRIORITY.findIndex(k => dA.includes(k));
    const iB = PRODUCT_PRIORITY.findIndex(k => dB.includes(k));
    if (iA === -1 && iB === -1) return dA.localeCompare(dB);
    if (iA === -1) return 1;
    if (iB === -1) return -1;
    return iA - iB;
  });

  // Auto-selecionar PAR CARRO MERCOSUL quando cliente é escolhido (novo pedido)
  useEffect(() => {
    if (selectedCustomer && sortedProducts.length > 0 && !itemProduct && !editOrderId) {
      const parCarro = sortedProducts[0];
      if (parCarro) handleProductChange(parCarro.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, products.length]);

  const handleProductChange = async (productId: string) => {
    setItemProduct(productId);
    if (productId && selectedCustomer) {
      try {
        const res = await fetch(`/api/orders/price?customerId=${selectedCustomer}&productId=${productId}`);
        const data = await res.json();
        setItemPrice(String(data?.price ?? 0));
      } catch {}
    }
  };

  const addItem = () => {
    if (!selectedCustomer) { toast.error('Selecione o cliente antes'); return; }
    if (!itemProduct) { toast.error('Selecione um produto'); return; }

    // Validar placa se informada
    if (itemPlate) {
      const cleanPlate = itemPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!validatePlate(cleanPlate)) {
        toast.error('Placa inválida. Use o padrão ABC1D23');
        return;
      }
      // Verificar placa duplicada
      if (orderItems.some((it: any) => it?.plateNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanPlate)) {
        toast.error('Esta placa já foi adicionada neste pedido');
        return;
      }
    }

    const prod = products?.find((p: any) => p?.id === itemProduct);
    const price = parseFloat(itemPrice) || 0;
    if (price <= 0) {
      toast.error('Preço não encontrado. Verifique a tabela de preço do cliente.');
      return;
    }

    setOrderItems([...orderItems, {
      productId: itemProduct,
      description: prod?.description ?? '',
      plateNumber: itemPlate,
      unitPrice: price,
      quantity: 1,
    }]);
    setItemPlate('');
    setTimeout(() => plateInputRef.current?.focus(), 50);
  };

  const removeItem = (i: number) => setOrderItems(orderItems?.filter((_: any, idx: number) => idx !== i));

  const orderTotal = (orderItems ?? [])?.reduce((s: number, it: any) => s + ((it?.unitPrice ?? 0) * (it?.quantity ?? 1)), 0);

  // === SALVAR PEDIDO ===
  const handleSave = async (receiveNow = false) => {
    if (!selectedCustomer) { toast.error('Selecione um cliente'); return; }
    if ((orderItems ?? [])?.length === 0) { toast.error('Adicione pelo menos um item'); return; }

    // Validação de edição: total não pode ser menor que valor já recebido
    if (editOrderId && orderTotal < editOrderPaid - 0.01) {
      toast.error(`Total (${formatCurrency(orderTotal)}) não pode ser menor que o valor já recebido (${formatCurrency(editOrderPaid)})`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomer,
        plateNumber,
        notes,
        items: orderItems,
      };

      let res;
      if (editOrderId) {
        // Edição
        res = await fetch('/api/orders', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editOrderId, ...payload }),
        });
      } else {
        // Criação
        res = await fetch('/api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); setSaving(false); return; }

      toast.success(editOrderId ? 'Pedido atualizado!' : 'Pedido criado!');

      if (receiveNow) {
        // Abrir modal de recebimento com o pedido recém-criado/editado
        const remaining = (data?.totalAmount ?? orderTotal) - (data?.paidAmount ?? 0);
        if (remaining > 0) {
          setShowReceive({
            id: data?.id,
            orderNumber: data?.orderNumber,
            totalAmount: data?.totalAmount ?? orderTotal,
            paidAmount: data?.paidAmount ?? 0,
            remaining,
            customerName: customers.find(c => c?.id === selectedCustomer)?.name ?? '',
          });
        }
      }

      // Limpar formulário mas manter modal aberto para novo pedido
      clearFormFields();
      loadOrders();
    } catch { toast.error('Erro ao salvar pedido'); }
    setSaving(false);
  };

  // Limpa campos mas mantém modal aberto (após inserir pedido)
  const clearFormFields = () => {
    setEditOrderId(null);
    setEditOrderPaid(0);
    setEditOrderStatus('');
    setEditOrderTotal(0);
    setEditOrderPaymentsSum(0);
    setSelectedCustomer('');
    setPlateNumber('');
    setNotes('');
    setOrderItems([]);
    setItemProduct('');
    setItemPrice('');
    setItemPlate('');
    setPlateWarning(null);
  };

  // Fecha modal completamente (botão Cancelar)
  const resetForm = () => {
    clearFormFields();
    setShowForm(false);
  };

  // === EDITAR PEDIDO ===
  const editOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders?id=${orderId}`);
      const order = await res.json();
      if (!order) { toast.error('Pedido não encontrado'); return; }

      setEditOrderId(order.id);
      setEditOrderPaid(order.paidAmount ?? 0);
      setEditOrderStatus(order.status ?? '');
      setEditOrderTotal(order.totalAmount ?? 0);
      setEditOrderPaymentsSum((order.payments ?? []).reduce((s: number, p: any) => s + (p?.amount ?? 0), 0));
      setSelectedCustomer(order.customerId);
      setPlateNumber(order.plateNumber ?? '');

      setNotes(order.notes ?? '');
      setOrderItems((order.items ?? []).map((it: any) => ({
        productId: it.productId,
        description: it.description ?? it.product?.description ?? '',
        plateNumber: it.plateNumber ?? '',
        unitPrice: it.unitPrice ?? 0,
        quantity: it.quantity ?? 1,
      })));
      setShowForm(true);
      toast.info('Pedido carregado para alteração');
    } catch { toast.error('Erro ao carregar pedido'); }
  };

  const loadOrderDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/orders?id=${id}`);
      const data = await res.json();
      setViewOrder(data);
    } catch { toast.error('Erro ao carregar pedido'); }
  };

  // === RECEBIMENTO ===
  const openReceiveFromList = (order: any) => {
    const remaining = (order?.totalAmount ?? 0) - (order?.paidAmount ?? 0);
    if (remaining <= 0) { toast.info('Pedido já está pago'); return; }
    setShowReceive({
      id: order?.id,
      orderNumber: order?.orderNumber,
      totalAmount: order?.totalAmount,
      paidAmount: order?.paidAmount,
      remaining,
      customerName: order?.customer?.name ?? '',
    });
  };

  // === EXCLUIR PEDIDO (soft delete) ===
  const handleDelete = async () => {
    if (!showDelete?.id) return;
    if (deleteReason.trim().length < 5) { toast.error('Motivo deve ter pelo menos 5 caracteres'); return; }
    setDeleting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showDelete.id, reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro ao excluir'); setDeleting(false); return; }
      toast.success(`Pedido #${showDelete.orderNumber} excluído com sucesso`);
      setShowDelete(null);
      setDeleteReason('');
      loadOrders();
    } catch { toast.error('Erro ao excluir pedido'); }
    setDeleting(false);
  };

  // === BUSCA POR PLACA ===
  const handleSearchPlate = () => {
    setPage(1);
    loadOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Pedidos
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} pedidos</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Novo Pedido
        </button>
      </div>

      {/* Filters + Busca por Placa */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchPlate}
            onChange={(e) => setSearchPlate(maskPlate(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchPlate()}
            placeholder="Buscar por placa..."
            maxLength={7}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none w-48 uppercase"
          />
        </div>
        <select value={filterStatus} onChange={(e: any) => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
          <option value="">Todos os status</option>
          <option value="ABERTO">Em Aberto</option>
          <option value="PAGO">Pago</option>
        </select>
        <input type="date" value={filterDate} onChange={(e: any) => { setFilterDate(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
        {(searchPlate || filterStatus || filterDate) && (
          <button onClick={() => { setSearchPlate(''); setFilterStatus(''); setFilterDate(''); setPage(1); }} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
            <X className="w-4 h-4" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Itens</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? [])?.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Nenhum pedido encontrado</td></tr>
                )}
                {(orders ?? [])?.map((o: any) => {
                  const remaining = (o?.totalAmount ?? 0) - (o?.paidAmount ?? 0);
                  return (
                    <tr key={o?.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">#{o?.orderNumber}</td>
                      <td className="px-4 py-3">{o?.customer?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-center">{o?._count?.items ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(o?.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o?.status] ?? ''}`}>
                          {STATUS_LABELS[o?.status] ?? o?.status}
                        </span>
                        {(() => {
                          const sumPay = (o?.payments ?? []).reduce((s: number, p: any) => s + (p?.amount ?? 0), 0);
                          return o?.status === 'PAGO' && sumPay < (o?.totalAmount ?? 0) - 0.01 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 ml-1">c/ desconto</span>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(o?.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => loadOrderDetail(o?.id)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => editOrder(o?.id)} className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600" title="Editar pedido"><Edit className="w-4 h-4" /></button>
                          {remaining > 0 && (
                            <button onClick={() => openReceiveFromList(o)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Receber"><DollarSign className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => { setShowDelete(o); setDeleteReason(''); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Excluir pedido"><Trash2 className="w-4 h-4" /></button>
                        </div>
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
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ===== NEW/EDIT ORDER FORM MODAL ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                  {editOrderId ? <><Edit className="w-5 h-5" /> Editar Pedido</> : <><Plus className="w-5 h-5" /> Novo Pedido</>}
                </h2>
                {editOrderId && editOrderPaid > 0 && (
                  editOrderStatus === 'PAGO' && editOrderPaymentsSum < editOrderTotal - 0.01 ? (
                    <div className="text-xs mt-1 space-y-0.5">
                      <p className="text-green-700">✅ Recebido: {formatCurrency(editOrderPaymentsSum)}</p>
                      <p className="text-orange-600">🏷️ Desconto: {formatCurrency(editOrderTotal - editOrderPaymentsSum)}</p>
                      <p className="text-gray-500">O total não pode ser menor que {formatCurrency(editOrderPaymentsSum)}.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Já recebido: {formatCurrency(editOrderPaid)}. O total não pode ser menor.
                    </p>
                  )
                )}
              </div>
              <button onClick={resetForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Indicador de pedido em digitação */}
            <div className="bg-blue-50 rounded-lg px-3 py-2 mb-4 text-sm text-blue-700 font-medium">
              {editOrderId ? '✏️ Pedido em alteração' : '📝 Pedido em digitação'}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                {selectedCustomer ? (
                  <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
                    {customers?.find((c: any) => c?.id === selectedCustomer)?.name ?? 'Cliente selecionado'}
                  </div>
                ) : (
                  <select value={selectedCustomer} onChange={(e: any) => { setSelectedCustomer(e.target.value); if (e.target.value) setTimeout(() => plateInputRef.current?.focus(), 50); }} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                    <option value="">Selecione...</option>
                    {(customers ?? [])?.map((c: any) => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Add Items - só aparece após selecionar cliente */}
            {selectedCustomer ? (<>
            <div className="border-t pt-4 mb-4">
              <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">Itens do Pedido</h3>
              <p className="text-xs text-gray-500 mb-3">Adicione uma ou várias placas no mesmo pedido.</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
                <div>
                  <label className="block text-xs font-medium mb-1">Placa *</label>
                  <input
                    ref={plateInputRef}
                    value={itemPlate}
                    onChange={(e: any) => setItemPlate(maskPlate(e.target.value))}
                    placeholder="ABC1D23"
                    maxLength={7}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none uppercase ${plateWarning ? 'border-orange-400' : ''}`}
                  />
                  {plateChecking && <p className="text-xs text-gray-400 mt-0.5">Verificando...</p>}
                  {plateWarning && !plateChecking && (
                    <p className="text-xs text-orange-600 mt-0.5 font-medium">
                      ⚠ Placa já usada no pedido #{plateWarning.orderNumber} ({plateWarning.customer})
                    </p>
                  )}
                  {!plateWarning && !plateChecking && <p className="text-xs text-gray-400 mt-0.5">Padrão: ABC1D23</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Produto *</label>
                  <select value={itemProduct} onChange={(e: any) => handleProductChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                    <option value="">Selecione...</option>
                    {sortedProducts.map((p: any) => <option key={p?.id} value={p?.id}>{p?.description}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={itemPrice} onChange={(e: any) => setItemPrice(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                  <p className="text-xs text-gray-400 mt-0.5">Pela tabela do cliente</p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 invisible">.</label>
                  <button onClick={addItem} className="w-full bg-[#2B7DB7] hover:bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Adicionar
                  </button>
                </div>
              </div>

              {(orderItems ?? [])?.length > 0 && (
                <table className="w-full text-sm mt-3">
                  <thead><tr className="border-b text-left text-gray-500 text-xs">
                    <th className="pb-2">Placa</th><th className="pb-2">Produto</th><th className="pb-2 text-right">Valor</th><th className="pb-2"></th>
                  </tr></thead>
                  <tbody>
                    {(orderItems ?? [])?.map((it: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-mono text-base font-bold text-[#1E3A5F] tracking-wide">{it?.plateNumber || '-'}</td>
                        <td className="py-2">{it?.description}</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(it?.unitPrice)}</td>
                        <td className="py-2 text-right">
                          <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50"><td colSpan={2} className="py-2 font-semibold text-right">Total:</td><td className="py-2 text-right font-bold font-mono text-[#1E3A5F] text-lg">{formatCurrency(orderTotal)}</td><td></td></tr>
                  </tbody>
                </table>
              )}
            </div>


            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea value={notes} onChange={(e: any) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
            </div>
            </>) : (
              <div className="border-t pt-4 mb-4">
                <p className="text-sm text-gray-400 text-center py-6">Selecione um cliente acima para começar a adicionar itens ao pedido.</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Save className="w-4 h-4" />
                {editOrderId ? 'Salvar Alterações' : 'Inserir'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <DollarSign className="w-4 h-4" />
                Inserir e Receber
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECEIVE PAYMENT MODAL ===== */}
      {showReceive && (
        <PaymentFormModal
          order={showReceive}
          onClose={() => setShowReceive(null)}
          onSuccess={() => loadOrders()}
        />
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Excluir Pedido #{showDelete?.orderNumber}
              </h2>
              <button onClick={() => setShowDelete(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Esta ação irá excluir o pedido do sistema. O registro será mantido para auditoria, mas não aparecerá mais nas listagens.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">Motivo da exclusão *</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder="Informe o motivo da exclusão (mínimo 5 caracteres)..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">{deleteReason.trim().length}/5 caracteres mínimos</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDelete(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteReason.trim().length < 5}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Trash2 className="w-4 h-4" /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== VIEW ORDER MODAL ===== */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">Pedido #{viewOrder?.orderNumber}</h2>
              <button onClick={() => setViewOrder(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Cliente:</span><span className="font-medium">{viewOrder?.customer?.name}</span></div>

              <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[viewOrder?.status] ?? ''}`}>{STATUS_LABELS[viewOrder?.status] ?? viewOrder?.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-bold font-mono">{formatCurrency(viewOrder?.totalAmount)}</span></div>
              {(() => {
                const sumPay = (viewOrder?.payments ?? []).reduce((s: number, p: any) => s + (p?.amount ?? 0), 0);
                const discountVal = (viewOrder?.totalAmount ?? 0) - sumPay;
                const saldo = Math.max(0, (viewOrder?.totalAmount ?? 0) - (viewOrder?.paidAmount ?? 0));
                if (viewOrder?.status === 'PAGO' && discountVal > 0.01) {
                  return (<>
                    <div className="flex justify-between"><span className="text-gray-500">Recebido:</span><span className="font-mono text-green-600">{formatCurrency(sumPay)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Desconto:</span><span className="font-mono text-orange-600">{formatCurrency(discountVal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Saldo:</span><span className="font-mono text-red-600 font-bold">{formatCurrency(saldo)}</span></div>
                  </>);
                }
                return (<>
                  <div className="flex justify-between"><span className="text-gray-500">Pago:</span><span className="font-mono text-green-600">{formatCurrency(viewOrder?.paidAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Saldo:</span><span className="font-mono text-red-600 font-bold">{formatCurrency(saldo)}</span></div>
                </>);
              })()}
              <div className="flex justify-between"><span className="text-gray-500">Data:</span><span>{formatDateTime(viewOrder?.createdAt)}</span></div>
              {viewOrder?.notes && <div className="flex justify-between"><span className="text-gray-500">Obs:</span><span>{viewOrder.notes}</span></div>}
            </div>
            <div className="border-t mt-4 pt-4">
              <h4 className="text-sm font-semibold mb-2">Itens ({(viewOrder?.items ?? []).length})</h4>
              {(viewOrder?.items ?? [])?.map((it: any) => (
                <div key={it?.id} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                  <div>
                    <span className="font-mono text-sm font-bold text-[#1E3A5F]">{it?.plateNumber || '-'}</span>
                    <span className="ml-2 text-gray-600">{it?.description}</span>
                  </div>
                  <span className="font-mono">{formatCurrency(it?.totalPrice)}</span>
                </div>
              ))}
            </div>
            {(viewOrder?.payments ?? [])?.length > 0 && (
              <div className="border-t mt-4 pt-4">
                <h4 className="text-sm font-semibold mb-2">Pagamentos</h4>
                {(viewOrder?.payments ?? [])?.map((p: any) => (
                  <div key={p?.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{PAYMENT_LABELS[p?.paymentMethod] ?? p?.paymentMethod} - {formatDateTime(p?.createdAt)}</span>
                    <span className="font-mono text-green-600">{formatCurrency(p?.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
