'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { UserCog, Plus, Edit, Trash2, Loader2, X, Search, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ROLE_LABELS, ROLES } from '@/lib/permissions';
import { maskPhone } from '@/lib/utils';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  active: boolean;
  commissionRate: number;
  discountLimit: number;
  createdAt: string;
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'vendedor',
  phone: '',
  active: true,
  commissionRate: 0,
  discountLimit: 0,
};

export function FuncionariosContent() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/funcionarios');
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error('Erro ao carregar funcionários');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      confirmPassword: '',
      role: u.role,
      phone: u.phone || '',
      active: u.active,
      commissionRate: u.commissionRate || 0,
      discountLimit: u.discountLimit || 0,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }
    if (!editingId && !form.password) {
      toast.error('Senha é obrigatória para novo funcionário');
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    setSaving(true);
    try {
      const body: any = { ...form };
      delete body.confirmPassword;
      if (editingId) {
        body.id = editingId;
        if (!body.password) delete body.password;
      }
      const res = await fetch('/api/funcionarios', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Erro ao salvar');
      }
      toast.success(editingId ? 'Funcionário atualizado!' : 'Funcionário criado!');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Desativar funcionário "${name}"?`)) return;
    try {
      const res = await fetch('/api/funcionarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success('Funcionário desativado');
      load();
    } catch {
      toast.error('Erro ao desativar');
    }
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcon = (role: string) => {
    if (role === 'admin') return <ShieldCheck className="w-4 h-4 text-green-600" />;
    if (role === 'vendedor') return <Shield className="w-4 h-4 text-blue-600" />;
    return <ShieldAlert className="w-4 h-4 text-orange-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <UserCog className="w-6 h-6" /> Funcionários
        </h1>
        <button
          onClick={openNew}
          className="bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1E3A5F] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Funcionário
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2B7DB7]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhum funcionário encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Telefone</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Comissão</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Comissão</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Lim. Desconto</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={`border-t hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        {roleIcon(u.role)}
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">{u.commissionRate ? `${u.commissionRate}%` : '-'}</td>
                    <td className="px-4 py-3 text-center">{u.discountLimit ? `R$ ${u.discountLimit.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-[#2B7DB7] hover:text-[#1E3A5F] p-1" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        {u.active && (
                          <button onClick={() => handleDelete(u.id, u.name)} className="text-red-400 hover:text-red-600 p-1" title="Desativar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 sm:pt-12" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()} style={{ boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#1E3A5F]">
                {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Senha {editingId ? '(deixe vazio para manter)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Confirmar Senha {editingId ? '' : '*'}
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Telefone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cargo *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Comissão (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={form.commissionRate}
                    onChange={(e) => setForm({ ...form, commissionRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Lim. Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discountLimit}
                    onChange={(e) => setForm({ ...form, discountLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                    placeholder="0 = sem limite (admin)"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Máximo de desconto permitido por baixa. Admins = ilimitado.</p>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="w-4 h-4 text-[#2B7DB7] rounded"
                    />
                    <span className="text-sm font-medium">Ativo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#2B7DB7] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#1E3A5F] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}