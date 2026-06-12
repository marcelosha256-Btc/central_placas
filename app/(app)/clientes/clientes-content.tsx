'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Users, Plus, Search, Edit, Trash2, MessageCircle, Loader2, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { maskCPF, maskCNPJ, maskPhone, maskCEP, onlyDigits, validateCPF, validateCNPJ, formatDate } from '@/lib/utils';

const emptyForm = {
  id: '', name: '', personType: 'PF', document: '', phone: '', whatsapp: '', email: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', priceTableId: '', sellerId: '', monthlyReport: false, reportType: 'detalhado', paymentTerm: 'AVISTA',
};

export function ClientesContent() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [priceTables, setPriceTables] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [docError, setDocError] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?page=${page}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setCustomers(data?.customers ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch { toast.error('Erro ao carregar clientes'); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    fetch('/api/price-tables?all=1').then(r => r.json()).then(d => setPriceTables(d ?? [])).catch(() => {});
    fetch('/api/funcionarios').then(r => r.json()).then(d => {
      const vendedores = (d?.users || []).filter((u: any) => u.active && u.role === 'vendedor');
      setSellers(vendedores);
    }).catch(() => {});
  }, []);

  const checkDuplicateDoc = async (digits: string, currentId: string) => {
    try {
      const res = await fetch(`/api/customers?search=${digits}&limit=50`);
      const data = await res.json();
      const dup = (data?.customers ?? []).find((c: any) => c.document === digits && c.id !== currentId);
      if (dup) {
        setDocError(`CPF/CNPJ já cadastrado para: ${dup.name}`);
      }
    } catch {}
  };

  const handleDoc = (v: string) => {
    const digits = onlyDigits(v);
    const isPJ = form.personType === 'PJ';
    const masked = isPJ ? maskCNPJ(v) : maskCPF(v);
    setForm({ ...form, document: masked });
    if (isPJ && digits.length === 14) {
      if (!validateCNPJ(digits)) {
        setDocError('CNPJ inválido');
      } else {
        setDocError('');
        checkDuplicateDoc(digits, form.id);
      }
    } else if (!isPJ && digits.length === 11) {
      if (!validateCPF(digits)) {
        setDocError('CPF inválido');
      } else {
        setDocError('');
        checkDuplicateDoc(digits, form.id);
      }
    } else {
      setDocError('');
    }
  };

  const handleCEP = async (v: string) => {
    const masked = maskCEP(v);
    setForm((f: any) => ({ ...f, cep: masked }));
    const digits = onlyDigits(v);
    if (digits.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data?.erro) {
          setForm((f: any) => ({
            ...f, cep: masked,
            street: data?.logradouro ?? f.street,
            neighborhood: data?.bairro ?? f.neighborhood,
            city: data?.localidade ?? f.city,
            state: data?.uf ?? f.state,
          }));
        }
      } catch {}
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.document) { toast.error('Preencha nome e documento'); return; }
    const digits = onlyDigits(form.document);
    if (form.personType === 'PF' && !validateCPF(digits)) { toast.error('CPF inválido'); return; }
    if (form.personType === 'PJ' && !validateCNPJ(digits)) { toast.error('CNPJ inválido'); return; }

    setSaving(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const res = await fetch('/api/customers', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setDocError('CPF/CNPJ já cadastrado no sistema');
        }
        toast.error(data?.error ?? 'Erro');
        setSaving(false);
        return;
      }
      toast.success(form.id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
      setShowForm(false);
      setForm({ ...emptyForm });
      loadCustomers();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const handleEdit = (c: any) => {
    const isPJ = (c?.personType ?? 'PF') === 'PJ';
    setForm({
      id: c?.id ?? '', name: c?.name ?? '', personType: c?.personType ?? 'PF',
      document: isPJ ? maskCNPJ(c?.document ?? '') : maskCPF(c?.document ?? ''),
      phone: maskPhone(c?.phone ?? ''), whatsapp: maskPhone(c?.whatsapp ?? ''),
      email: c?.email ?? '', cep: maskCEP(c?.cep ?? ''),
      street: c?.street ?? '', number: c?.number ?? '', complement: c?.complement ?? '',
      neighborhood: c?.neighborhood ?? '', city: c?.city ?? '', state: c?.state ?? '',
      priceTableId: c?.priceTableId ?? '', sellerId: c?.sellerId ?? '', monthlyReport: c?.monthlyReport ?? false, reportType: c?.reportType ?? 'detalhado', paymentTerm: c?.paymentTerm ?? 'AVISTA',
    });
    setDocError('');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success('Cliente excluído');
      loadCustomers();
    } catch { toast.error('Erro ao excluir'); }
  };

  const openWhatsApp = (wa: string) => {
    const digits = onlyDigits(wa);
    if (digits.length >= 10) window.open(`https://wa.me/55${digits}`, '_blank');
    else toast.error('WhatsApp inválido');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" /> Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} clientes cadastrados</p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setDocError(''); setShowForm(true); }} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome ou documento..."
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#2B7DB7] focus:border-transparent outline-none"
        />
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
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Telefone</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Cidade/UF</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Tabela</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Vendedor</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(customers ?? [])?.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Nenhum cliente encontrado</td></tr>
                )}
                {(customers ?? [])?.map((c: any) => (
                  <tr key={c?.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c?.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c?.personType === 'PJ' ? maskCNPJ(c?.document ?? '') : maskCPF(c?.document ?? '')}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{maskPhone(c?.phone ?? '')}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{c?.city}{c?.state ? `/${c.state}` : ''}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">{c?.priceTable?.name ?? '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">{c?.seller?.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {c?.whatsapp && (
                          <button onClick={() => openWhatsApp(c.whatsapp)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c?.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Excluir">
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
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 mb-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1E3A5F]">{form.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Nome *</label>
                <input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select value={form.personType} onChange={(e: any) => { setForm({ ...form, personType: e.target.value, document: '' }); setDocError(''); }} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{form.personType === 'PJ' ? 'CNPJ *' : 'CPF *'}</label>
                <input value={form.document} onChange={(e: any) => handleDoc(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${docError ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[#2B7DB7]'}`} placeholder={form.personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} />
                {docError && <p className="text-xs text-red-500 mt-1">{docError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input value={form.phone} onChange={(e: any) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={(e: any) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} inputMode="tel" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" placeholder="(00) 00000-0000" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CEP</label>
                <input value={form.cep} onChange={(e: any) => handleCEP(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" placeholder="00000-000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rua</label>
                <input value={form.street} onChange={(e: any) => setForm({ ...form, street: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número</label>
                <input value={form.number} onChange={(e: any) => setForm({ ...form, number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Complemento</label>
                <input value={form.complement} onChange={(e: any) => setForm({ ...form, complement: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bairro</label>
                <input value={form.neighborhood} onChange={(e: any) => setForm({ ...form, neighborhood: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cidade</label>
                <input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">UF</label>
                <input value={form.state} onChange={(e: any) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tabela de Preço</label>
                <select value={form.priceTableId} onChange={(e: any) => setForm({ ...form, priceTableId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                  <option value="">Nenhuma</option>
                  {(priceTables ?? [])?.map((t: any) => <option key={t?.id} value={t?.id}>{t?.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vendedor Responsável</label>
                <select value={form.sellerId} onChange={(e: any) => setForm({ ...form, sellerId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                  <option value="">Nenhum</option>
                  {sellers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="monthlyReport" checked={form.monthlyReport} onChange={(e: any) => setForm({ ...form, monthlyReport: e.target.checked })} className="rounded border-gray-300" />
              <label htmlFor="monthlyReport" className="text-sm text-gray-700">Incluir no envio mensal de relatórios</label>
            </div>

            {form.monthlyReport && (
              <div className="mt-3 ml-6 flex items-center gap-3">
                <label className="text-sm text-gray-600 font-medium">Tipo de relatório:</label>
                <select value={form.reportType} onChange={(e: any) => setForm({ ...form, reportType: e.target.value })} className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                  <option value="detalhado">📋 Detalhado (pedidos individuais)</option>
                  <option value="resumido">📊 Resumido (tabela compacta)</option>
                </select>
                <span className="text-xs text-gray-400">{form.reportType === 'resumido' ? 'Ideal para clientes com muitos pedidos' : 'Ideal para poucos pedidos com pagamentos parciais'}</span>
              </div>
            )}

            {form.monthlyReport && (
              <div className="mt-3 ml-6 flex items-center gap-3">
                <label className="text-sm text-gray-600 font-medium">Prazo de pagamento:</label>
                <select value={form.paymentTerm} onChange={(e: any) => setForm({ ...form, paymentTerm: e.target.value })} className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none">
                  <option value="AVISTA">À Vista</option>
                  <option value="D15">15 dias (D+15)</option>
                  <option value="D30">30 dias (D+30)</option>
                </select>
                <span className="text-xs text-gray-400">{form.paymentTerm === 'AVISTA' ? 'Pagamento na entrega' : form.paymentTerm === 'D15' ? 'Vencimento 15 dias após fechamento' : 'Vencimento 30 dias após fechamento'}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !!docError} className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
