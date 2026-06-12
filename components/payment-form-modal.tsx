'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X, Plus, Trash2, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { PAYMENT_OPTIONS_RECEBIMENTO, PAYMENT_OPTIONS, type PayForm } from '@/lib/constants';

interface OrderSummary {
  id: string;
  orderNumber?: number;
  customerName?: string;
  totalAmount?: number;
  paidAmount?: number;
  remaining?: number;
}

interface PaymentFormModalProps {
  order: OrderSummary;
  onClose: () => void;
  onSuccess: () => void;
  /** Se true, inclui opção "A Prazo" (default: false) */
  includeAPrazo?: boolean;
  /** Bulk mode: array of order IDs to pay at once */
  bulkOrderIds?: string[];
  /** Label for bulk mode header */
  bulkLabel?: string;
}

export function PaymentFormModal({ order, onClose, onSuccess, includeAPrazo = false, bulkOrderIds, bulkLabel }: PaymentFormModalProps) {
  const remaining = order.remaining ?? ((order.totalAmount ?? 0) - (order.paidAmount ?? 0));
  const [payForms, setPayForms] = useState<PayForm[]>([{ method: 'PIX', value: remaining.toFixed(2) }]);
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [saving, setSaving] = useState(false);

  const options = includeAPrazo ? PAYMENT_OPTIONS : PAYMENT_OPTIONS_RECEBIMENTO;

  const totalPaying = payForms.reduce((sum, f) => sum + (parseFloat(f.value) || 0), 0);

  const addPayForm = () => setPayForms(prev => [...prev, { method: 'DINHEIRO', value: '' }]);

  const removePayForm = (index: number) => {
    setPayForms(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [{ method: 'PIX', value: '' }] : next;
    });
  };

  const updatePayForm = (index: number, field: keyof PayForm, value: string) => {
    setPayForms(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const discountValue = discount ? parseFloat(discount.replace(',', '.')) : 0;

  const handlePayment = async () => {
    if (totalPaying <= 0 && discountValue <= 0) { toast.error('Informe pelo menos um valor ou desconto'); return; }
    if ((totalPaying + discountValue) - remaining > 0.01) { toast.error('Valor recebido + desconto maior que o saldo devedor'); return; }
    if (discountValue > 0 && !discountReason.trim()) { toast.error('Informe o motivo do desconto'); return; }

    setSaving(true);
    try {
      const paymentForms = payForms
        .filter(f => parseFloat(f.value) > 0)
        .map(f => ({ method: f.method, value: parseFloat(f.value) }));

      const isBulk = bulkOrderIds && bulkOrderIds.length > 0;
      const baseBody = isBulk
        ? { orderIds: bulkOrderIds, paymentForms }
        : { orderId: order.id, paymentForms };
      const body = {
        ...baseBody,
        discount: discountValue || 0,
        discountReason: discountReason.trim(),
      };

      const res = await fetch(isBulk ? '/api/payments/bulk' : '/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao processar pagamento');
        setSaving(false);
        return;
      }
      toast.success('Recebimento registrado!');
      onClose();
      onSuccess();
    } catch {
      toast.error('Erro ao processar pagamento');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> {bulkLabel || (order.orderNumber ? `Receber Pedido #${order.orderNumber}` : 'Receber')}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Resumo do Pedido */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <div className="text-sm space-y-1">
            {order.customerName && (
              <div className="flex justify-between"><span className="text-gray-600">Cliente:</span><span className="font-medium">{order.customerName}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-600">Total:</span><span className="font-mono">{formatCurrency(order.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Já pago:</span><span className="font-mono text-green-600">{formatCurrency(order.paidAmount)}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-600 font-bold">Saldo:</span><span className="font-mono text-red-600 font-bold text-lg">{formatCurrency(remaining)}</span></div>
          </div>
        </div>

        {/* Formas de Pagamento */}
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Formas de Pagamento</h3>
        <div className="space-y-2 mb-3">
          {payForms.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
              <select
                value={f.method}
                onChange={(e) => updatePayForm(i, 'method', e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
              >
                {options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={f.value}
                onChange={(e) => updatePayForm(i, 'value', e.target.value)}
                placeholder="R$ 0,00"
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none font-mono"
              />
              <button
                onClick={() => removePayForm(i)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addPayForm} className="text-sm text-[#2B7DB7] hover:text-[#1E3A5F] font-medium flex items-center gap-1 mb-4">
          <Plus className="w-4 h-4" /> Adicionar forma de pagamento
        </button>

        {/* Desconto */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-600 mb-1">Desconto (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
            const val = e.target.value;
            setDiscount(val);
            const dv = val ? parseFloat(val.replace(',', '.')) : 0;
            const newTarget = Math.max(0, remaining - (dv || 0));
            if (payForms.length === 1) {
              setPayForms([{ ...payForms[0], value: newTarget.toFixed(2) }]);
            }
          }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
            placeholder="0,00"
          />
          <p className="text-[11px] text-gray-400 mt-1">Opcional. O desconto não entra no caixa, apenas abate o saldo do pedido.</p>
        </div>

        {discountValue > 0 && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-600 mb-1">Motivo do desconto <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
              placeholder="Ex: desconto fidelidade, acordo comercial..."
            />
          </div>
        )}

        {/* Total */}
        <div className={`rounded-lg p-3 mb-4 ${
          Math.abs(totalPaying + discountValue - remaining) < 0.01
            ? 'bg-green-50 border border-green-200'
            : 'bg-gray-50 border'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total a receber:</span>
            <span className="font-mono font-bold text-lg">{formatCurrency(totalPaying)}</span>
          </div>
          {discountValue > 0 && (
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-500">Desconto:</span>
              <span className="font-mono text-red-600">{formatCurrency(discountValue)}</span>
            </div>
          )}
          {discountValue > 0 && (
            <div className="flex justify-between items-center border-t pt-1 mt-1">
              <span className="text-sm font-bold">Quita:</span>
              <span className="font-mono font-bold">{formatCurrency(totalPaying + discountValue)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handlePayment}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar Recebimento
          </button>
        </div>
      </div>
    </div>
  );
}
