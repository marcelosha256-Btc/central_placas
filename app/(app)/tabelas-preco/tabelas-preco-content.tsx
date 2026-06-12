'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Tag, Plus, Edit, Loader2, X, DollarSign, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function TabelasPrecoContent() {
  const [tables, setTables] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTableForm, setShowTableForm] = useState(false);
  const [tableName, setTableName] = useState('');
  const [editingTable, setEditingTable] = useState<any>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/price-tables');
      const data = await res.json();
      setTables(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  const loadAllProducts = async () => {
    try {
      const res = await fetch('/api/products?all=1');
      const data = await res.json();
      setAllProducts(data ?? []);
    } catch {}
  };

  useEffect(() => { loadTables(); loadAllProducts(); }, [loadTables]);

  const handleCreateTable = async () => {
    if (!tableName) { toast.error('Nome obrigatório'); return; }
    try {
      const res = await fetch('/api/price-tables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tableName }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Tabela criada!');
      setTableName('');
      setShowTableForm(false);
      loadTables();
    } catch { toast.error('Erro'); }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Excluir esta tabela de preço?')) return;
    try {
      const res = await fetch(`/api/price-tables?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Tabela excluída');
      loadTables();
    } catch { toast.error('Erro ao excluir'); }
  };

  const startEditPrices = (table: any) => {
    setEditingTable(table);
    const edits: Record<string, string> = {};
    for (const item of table?.items ?? []) {
      edits[item?.productId] = String(item?.price ?? 0);
    }
    setPriceEdits(edits);
  };

  const savePrices = async () => {
    if (!editingTable) return;
    setSavingPrices(true);
    try {
      const items = Object.entries(priceEdits ?? {}).map(([productId, price]) => ({ productId, price }));
      await fetch('/api/price-tables', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTable.id, items }),
      });
      toast.success('Preços salvos!');
      setEditingTable(null);
      loadTables();
    } catch { toast.error('Erro ao salvar preços'); }
    setSavingPrices(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Tag className="w-6 h-6" /> Tabelas de Preço
        </h1>
        <button onClick={() => setShowTableForm(true)} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Nova Tabela
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(tables ?? [])?.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">Nenhuma tabela de preço cadastrada</div>
          )}
          {(tables ?? [])?.map((t: any) => (
            <div key={t?.id} className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#1E3A5F] flex items-center gap-2"><DollarSign className="w-4 h-4" /> {t?.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t?._count?.customers ?? 0} clientes</span>
                  <button onClick={() => handleDeleteTable(t?.id)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Excluir tabela">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm mb-3">
                {(t?.items ?? [])?.length === 0 && <p className="text-gray-400 text-xs">Nenhum preço configurado</p>}
                {(t?.items ?? [])?.slice(0, 5)?.map((item: any) => (
                  <div key={item?.id} className="flex justify-between">
                    <span className="text-gray-600">{item?.product?.description ?? '-'}</span>
                    <span className="font-mono">{formatCurrency(item?.price)}</span>
                  </div>
                ))}
                {(t?.items ?? [])?.length > 5 && <p className="text-xs text-gray-400">+{(t?.items?.length ?? 0) - 5} mais...</p>}
              </div>
              <button onClick={() => startEditPrices(t)} className="text-sm text-[#2B7DB7] hover:underline flex items-center gap-1">
                <Edit className="w-3 h-3" /> Editar preços
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Table Modal */}
      {showTableForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h2 className="text-lg font-bold text-[#1E3A5F] mb-4">Nova Tabela de Preço</h2>
            <input value={tableName} onChange={(e: any) => setTableName(e.target.value)} placeholder="Nome da tabela" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowTableForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreateTable} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prices Modal */}
      {editingTable && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">Preços - {editingTable?.name}</h2>
              <button onClick={() => setEditingTable(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {(allProducts ?? [])?.map((p: any) => (
                <div key={p?.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm flex-1">{p?.description}</span>
                  <div className="w-32">
                    <input
                      type="number" step="0.01" placeholder="0.00"
                      value={priceEdits[p?.id] ?? ''}
                      onChange={(e: any) => setPriceEdits({ ...priceEdits, [p.id]: e.target.value })}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingTable(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={savePrices} disabled={savingPrices} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {savingPrices && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Preços
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
