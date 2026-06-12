'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Package, Plus, Edit, Trash2, Loader2, X, Search, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function ProdutosContent() {
  const [products, setProducts] = useState<any[]>([]);
  const [baseProducts, setBaseProducts] = useState<any[]>([]); // produtos com trackStock=true
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', code: '', description: '', category: 'Placa', basePrice: '', trackStock: false, minStock: '', leadTimeDays: '7', stockItemId: '', consumptionQty: '1' });
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?page=${page}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setProducts(data?.products ?? []);
      setTotalProducts(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch { toast.error('Erro ao carregar produtos'); }
    setLoading(false);
  }, [page, search]);

  const loadBaseProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?all=1');
      const data = await res.json();
      setBaseProducts((data ?? []).filter((p: any) => p.trackStock));
    } catch {}
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadBaseProducts(); }, [loadBaseProducts]);

  const handleSaveProduct = async () => {
    if (!form.code || !form.description) { toast.error('Código e descrição obrigatórios'); return; }
    setSaving(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const res = await fetch('/api/products', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Erro'); setSaving(false); return; }
      toast.success(form.id ? 'Produto atualizado!' : 'Produto cadastrado!');
      setShowForm(false);
      setForm({ id: '', code: '', description: '', category: 'Placa', basePrice: '', trackStock: false, minStock: '', leadTimeDays: '7', stockItemId: '', consumptionQty: '1' });
      loadProducts();
      loadBaseProducts();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Produto excluído');
      loadProducts();
    } catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Package className="w-6 h-6" /> Produtos
        </h1>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar produto..." className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
        </div>
        <button onClick={() => { setForm({ id: '', code: '', description: '', category: 'Placa', basePrice: '', trackStock: false, minStock: '', leadTimeDays: '7', stockItemId: '', consumptionQty: '1' }); setShowForm(true); }} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Preço Base</th>
                  <th className="px-4 py-3 font-medium text-center">Estoque</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(products ?? [])?.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Nenhum produto encontrado</td></tr>
                )}
                {(products ?? [])?.map((p: any) => (
                  <tr key={p?.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p?.code}</td>
                    <td className="px-4 py-3 font-medium">{p?.description}</td>
                    <td className="px-4 py-3 text-gray-500">{p?.category}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(p?.basePrice)}</td>
                    <td className="px-4 py-3 text-center">
                      {p?.trackStock ? (
                        <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${(p?.stockQuantity ?? 0) <= (p?.minStock ?? 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {p?.stockQuantity ?? 0} un
                        </span>
                      ) : p?.stockItemId ? (
                        <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
                          <Link2 className="w-3 h-3" />{p?.consumptionQty ?? 1}x
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setForm({ id: p?.id, code: p?.code, description: p?.description, category: p?.category ?? 'Placa', basePrice: String(p?.basePrice ?? 0), trackStock: !!p?.trackStock, minStock: String(p?.minStock ?? 0), leadTimeDays: String(p?.leadTimeDays ?? 7), stockItemId: p?.stockItemId ?? '', consumptionQty: String(p?.consumptionQty ?? 1) }); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteProduct(p?.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
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

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">{form.id ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Código *</label><input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">Descrição *</label><input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">Categoria</label><input value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">Preço Base (R$)</label><input type="number" step="0.01" value={form.basePrice} onChange={(e: any) => setForm({ ...form, basePrice: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" /></div>

              {/* Controle de estoque */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Controle de Estoque</p>

                {/* Opção A: produto-base (chapa física) */}
                {!form.stockItemId && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={form.trackStock} onChange={(e: any) => setForm({ ...form, trackStock: e.target.checked })} className="rounded border-gray-300 text-[#2B7DB7] focus:ring-[#2B7DB7]" />
                      <span className="text-sm font-medium">Este produto é uma chapa base (controla saldo próprio)</span>
                    </label>
                    {form.trackStock && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Estoque mínimo (alerta de reposição)</label>
                          <input type="number" step="1" value={form.minStock} onChange={(e: any) => setForm({ ...form, minStock: e.target.value })} placeholder="Ex: 50" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Prazo do fornecedor (dias)</label>
                          <input type="number" step="1" min="1" value={form.leadTimeDays} onChange={(e: any) => setForm({ ...form, leadTimeDays: e.target.value })} placeholder="Ex: 7" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                          <p className="text-xs text-gray-400 mt-1">O sistema alerta quando o estoque não cobre esse prazo.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Opção B: produto de venda com fator de consumo */}
                {!form.trackStock && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Consome estoque de qual chapa base?</label>
                    <select value={form.stockItemId} onChange={(e: any) => setForm({ ...form, stockItemId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none bg-white">
                      <option value="">— Nenhuma (sem vínculo) —</option>
                      {baseProducts.filter(bp => bp.id !== form.id).map((bp: any) => (
                        <option key={bp.id} value={bp.id}>{bp.description} ({bp.stockQuantity ?? 0} un em estoque)</option>
                      ))}
                    </select>
                    {form.stockItemId && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Fator de consumo (chapas por venda)</label>
                        <input type="number" step="0.5" min="0.5" value={form.consumptionQty} onChange={(e: any) => setForm({ ...form, consumptionQty: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
                        <p className="text-xs text-gray-400 mt-1">Par = 2 · Dianteira = 1 · Traseira = 1 · Moto = 1</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveProduct} disabled={saving} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
