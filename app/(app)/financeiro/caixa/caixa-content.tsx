'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Wallet, DoorOpen, DoorClosed,
  Loader2, RotateCcw, AlertTriangle,
  Save, Lock, Unlock, Ban, User, Paperclip, Image as ImageIcon, X,
  FileWarning, CircleDollarSign, Calendar, ExternalLink
} from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';
import { MOVE_TYPE_LABELS, CASH_STATUS_LABELS } from '@/lib/constants';

export function CaixaContent() {
  const { data: session } = useSession() || {};
  const userRole = (session?.user as any)?.role ?? '';
  const isAdmin = userRole === 'admin';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showOpen, setShowOpen] = useState(false);

  const [showClose, setShowClose] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showReverse, setShowReverse] = useState<string | null>(null);

  // Abrir caixa
  const [initialBalance, setInitialBalance] = useState('');
  const [lastClosedBalance, setLastClosedBalance] = useState<number | null>(null);
  const [lastClosedInfo, setLastClosedInfo] = useState<{ closeDate: string | null; openDate: string | null; responsible: string } | null>(null);
  const [responsible, setResponsible] = useState('');



  // Conferência / Fechamento
  const [countedBalance, setCountedBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closeResponsible, setCloseResponsible] = useState('');

  // Reabrir
  const [reopenReason, setReopenReason] = useState('');

  // Estorno
  const [reverseReason, setReverseReason] = useState('');

  // Contas a Pagar Pendentes
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [payingExpenseId, setPayingExpenseId] = useState<string | null>(null);

  // Comprovantes
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewAttachment, setViewAttachment] = useState<{ url: string; contentType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMovementId = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cash');
      const d = await res.json();
      setData(d);
      if (d?.register) {
        setCloseResponsible(d.register.responsible || '');
      }
    } catch {}
    setLoading(false);
  };

  // Buscar contas a pagar pendentes
  const loadPendingExpenses = async () => {
    try {
      const res = await fetch('/api/expenses?status=PENDENTE&limit=100');
      const d = await res.json();
      setPendingExpenses(d?.expenses ?? []);
    } catch {
      setPendingExpenses([]);
    }
  };

  // Pagar conta diretamente do caixa
  const payExpense = async (expenseId: string) => {
    setPayingExpenseId(expenseId);
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expenseId, action: 'pay' }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao pagar conta');
        setPayingExpenseId(null);
        return;
      }
      toast.success('Conta paga! Saída registrada no caixa.');
      loadPendingExpenses();
      load(); // Recarrega caixa para atualizar saldo
    } catch {
      toast.error('Erro ao pagar conta');
    }
    setPayingExpenseId(null);
  };

  useEffect(() => { load(); loadPendingExpenses(); }, []);

  // Buscar saldo do último caixa fechado para pré-preencher
  const loadLastClosedBalance = async () => {
    try {
      const res = await fetch('/api/cash?lastClosed=1');
      const d = await res.json();
      const bal = d?.lastClosedBalance ?? 0;
      setLastClosedBalance(bal);
      setInitialBalance(String(bal));
      if (d?.lastResponsible) setResponsible(d.lastResponsible);
      setLastClosedInfo({
        closeDate: d?.lastCloseDate ?? null,
        openDate: d?.lastOpenDate ?? null,
        responsible: d?.lastResponsible ?? '',
      });
    } catch {
      setLastClosedBalance(null);
      setLastClosedInfo(null);
    }
  };

  const isOpen = data?.open;
  const reg = data?.register;
  const status = reg?.status ?? 'FECHADO';

  // Cálculo da diferença em tempo real
  const systemBalance = reg?.currentBalance ?? 0;
  const countedNum = countedBalance ? parseFloat(countedBalance) : null;
  const difference = countedNum !== null ? countedNum - systemBalance : null;

  // === AÇÕES ===

  const openCash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', initialBalance, responsible }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Caixa aberto com sucesso!');
      setShowOpen(false);
      setInitialBalance('');
      setResponsible('');
      load();
    } catch { toast.error('Erro ao abrir caixa'); }
    setSaving(false);
  };

  const openNextDay = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'openNextDay', responsible }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success(`Próximo dia aberto! Saldo herdado: ${formatCurrency(d?.inheritedBalance)}`);
      setShowOpen(false);
      setResponsible('');
      load();
    } catch { toast.error('Erro ao abrir próximo dia'); }
    setSaving(false);
  };

  const saveCash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          responsible: closeResponsible,
          countedBalance: countedNum,
          closingNotes,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Caixa salvo em conferência!');
      load();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const closeCash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          responsible: closeResponsible,
          countedBalance: countedNum,
          closingNotes,
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Caixa fechado com sucesso!');
      setShowClose(false);
      setCountedBalance('');
      setClosingNotes('');
      load();
    } catch { toast.error('Erro ao fechar caixa'); }
    setSaving(false);
  };

  const reopenCash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen', reopenReason }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Caixa reaberto!');
      setShowReopen(false);
      setReopenReason('');
      load();
    } catch { toast.error('Erro ao reabrir'); }
    setSaving(false);
  };



  // === COMPROVANTES ===
  // Comprimir imagem para resolução baixa antes do upload (max 800px, qualidade 0.5)
  const compressImage = useCallback((file: File): Promise<{ blob: Blob; contentType: string }> => {
    return new Promise((resolve, reject) => {
      const MAX_DIM = 800;
      const QUALITY = 0.5;
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas não suportado')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Erro ao comprimir imagem')); return; }
            resolve({ blob, contentType: 'image/jpeg' });
          },
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
      img.src = url;
    });
  }, []);

  const processFile = useCallback(async (file: File, movementId: string) => {
    setUploadingId(movementId);
    try {
      // Determinar content type (alguns celulares enviam vazio)
      let contentType = file.type;
      if (!contentType) {
        const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
        const typeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
          heif: 'image/heif', pdf: 'application/pdf',
        };
        contentType = typeMap[ext] || 'application/octet-stream';
      }

      // Comprimir imagens para resolução baixa (não afeta PDFs)
      let uploadBody: Blob | File = file;
      const isImage = contentType.startsWith('image/');
      if (isImage) {
        try {
          const compressed = await compressImage(file);
          uploadBody = compressed.blob;
          contentType = compressed.contentType;
        } catch (e) {
          console.warn('Compressão falhou, enviando original:', e);
        }
      }

      // 1. Get presigned URL
      const fileName = isImage ? file.name.replace(/\.[^.]+$/, '.jpg') : file.name;
      const presRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, contentType, isPublic: false }),
      });
      if (!presRes.ok) {
        const errData = await presRes.json().catch(() => ({}));
        throw new Error(errData?.error || `Erro ao gerar URL (${presRes.status})`);
      }
      const { uploadUrl, cloud_storage_path } = await presRes.json();

      // 2. Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: uploadBody,
      });
      if (!uploadRes.ok) {
        console.error('S3 upload failed:', uploadRes.status, await uploadRes.text().catch(() => ''));
        throw new Error(`Erro no upload (${uploadRes.status})`);
      }

      // 3. Save reference in DB
      const saveRes = await fetch('/api/cash/attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementId, cloud_storage_path }),
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData?.error || `Erro ao salvar (${saveRes.status})`);
      }

      toast.success('Comprovante anexado com sucesso!');
      load();
    } catch (err: any) {
      console.error('Attachment error:', err);
      toast.error(err?.message ?? 'Erro ao anexar comprovante', { duration: 5000 });
    }
    setUploadingId(null);
  }, [compressImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const movId = pendingMovementId.current;
    // Reset input value so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !movId) return;
    processFile(file, movId);
  }, [processFile]);

  const handleAttach = (movementId: string) => {
    pendingMovementId.current = movementId;
    // Use the persistent hidden input in the DOM
    fileInputRef.current?.click();
  };

  const handleViewAttachment = async (movementId: string) => {
    try {
      const res = await fetch(`/api/cash/attachment?movementId=${movementId}`);
      if (!res.ok) { toast.error('Comprovante não encontrado'); return; }
      const { url, contentType } = await res.json();
      setViewAttachment({ url, contentType });
    } catch {
      toast.error('Erro ao carregar comprovante');
    }
  };

  const reverseMovement = async () => {
    if (!reverseReason.trim()) { toast.error('Informe o motivo do estorno'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse', movementId: showReverse, reason: reverseReason }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d?.error ?? 'Erro'); setSaving(false); return; }
      toast.success('Movimentação estornada!');
      setShowReverse(null);
      setReverseReason('');
      load();
    } catch { toast.error('Erro ao estornar'); }
    setSaving(false);
  };

  // === RENDER ===

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2B7DB7]" /></div>;
  }

  const activeMovements = (reg?.movements ?? []).filter((m: any) => !m?.cancelled);
  const cancelledMovements = (reg?.movements ?? []).filter((m: any) => m?.cancelled);

  return (
    <div className="space-y-6">
      {/* Hidden file input persistente no DOM — necessário para câmera funcionar no celular */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight flex items-center gap-2">
          <Wallet className="w-6 h-6" /> Controle de Caixa
        </h1>
      </div>

      {/* Status Card */}
      <div className={`rounded-xl p-6 ${
        status === 'ABERTO' ? 'bg-green-50 border border-green-200' :
        status === 'EM_CONFERENCIA' ? 'bg-yellow-50 border border-yellow-200' :
        'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {status === 'ABERTO' && <DoorOpen className="w-6 h-6 text-green-600" />}
          {status === 'EM_CONFERENCIA' && <AlertTriangle className="w-6 h-6 text-yellow-600" />}
          {status === 'FECHADO' && <DoorClosed className="w-6 h-6 text-red-600" />}
          {!isOpen && <DoorClosed className="w-6 h-6 text-red-600" />}
          <span className={`text-lg font-bold ${
            status === 'ABERTO' ? 'text-green-700' :
            status === 'EM_CONFERENCIA' ? 'text-yellow-700' :
            'text-red-700'
          }`}>
            Caixa {isOpen ? CASH_STATUS_LABELS[status] || status : 'FECHADO'}
          </span>
          {reg?.responsible && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> {reg.responsible}
            </span>
          )}
        </div>

        {isOpen && reg && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-gray-500">Data Abertura</p>
              <p className="font-medium text-sm">{formatDateTime(reg?.openDate)}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-gray-500">Saldo Anterior</p>
              <p className="font-mono font-bold text-lg">{formatCurrency(reg?.initialBalance)}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-green-600">Entradas</p>
              <p className="font-mono font-bold text-lg text-green-600">+{formatCurrency(reg?.totalEntradas)}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-red-600">Saídas</p>
              <p className="font-mono font-bold text-lg text-red-600">-{formatCurrency(reg?.totalSaidas)}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-[#1E3A5F]">Saldo Sistema</p>
              <p className={`font-mono font-bold text-xl ${(reg?.currentBalance ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(reg?.currentBalance)}</p>
            </div>
          </div>
        )}

        {reg?.reopenReason && (
          <div className="mt-3 text-sm text-yellow-700 bg-yellow-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Reaberto: {reg.reopenReason}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isOpen && isAdmin && (
          <>
            <button onClick={() => { loadLastClosedBalance(); setShowOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <DoorOpen className="w-4 h-4" /> Abrir Caixa
            </button>
            <button onClick={() => { loadLastClosedBalance(); setShowReopen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Unlock className="w-4 h-4" /> Reabrir Último Caixa
            </button>
          </>
        )}
        {!isOpen && !isAdmin && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <Lock className="w-4 h-4" /> Caixa fechado. Somente administradores podem abrir/reabrir o caixa.
          </div>
        )}

      </div>

      {/* Contas a Pagar Pendentes */}
      {isOpen && pendingExpenses.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-amber-200" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-700 flex items-center gap-2">
              <FileWarning className="w-5 h-5" /> Contas a Pagar Pendentes
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{pendingExpenses.length} conta{pendingExpenses.length !== 1 ? 's' : ''}</span>
              <span className="font-mono font-bold text-amber-700">
                Total: {formatCurrency(pendingExpenses.reduce((s: number, e: any) => s + (e?.amount ?? 0), 0))}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50">
                <tr className="text-left text-gray-600 text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 font-medium">Categoria</th>
                  <th className="px-4 py-2 font-medium">Fornecedor</th>
                  <th className="px-4 py-2 font-medium text-right">Valor</th>
                  <th className="px-4 py-2 font-medium">Vencimento</th>
                  <th className="px-4 py-2 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pendingExpenses.map((exp: any) => {
                  const isOverdue = exp?.dueDate && new Date(exp.dueDate) < new Date();
                  return (
                    <tr key={exp?.id} className={`border-t hover:bg-amber-50/50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2 font-medium">{exp?.description}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{exp?.category}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{exp?.supplier || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-amber-700">{formatCurrency(exp?.amount)}</td>
                      <td className="px-4 py-2">
                        {exp?.dueDate ? (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(exp.dueDate)}
                            {isOverdue && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full ml-1">Vencida</span>}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => payExpense(exp?.id)}
                          disabled={payingExpenseId === exp?.id}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 mx-auto transition-colors disabled:opacity-50"
                        >
                          {payingExpenseId === exp?.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CircleDollarSign className="w-3 h-3" />}
                          Pagar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-100 flex justify-end">
            <a href="/financeiro/contas-pagar" className="text-sm text-[#2B7DB7] hover:text-[#1E3A5F] font-medium flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Ver todas as contas
            </a>
          </div>
        </div>
      )}

      {/* Movimentações do Dia */}
      {isOpen && activeMovements.length > 0 && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <h3 className="font-semibold text-[#1E3A5F] mb-3">Movimentações do Dia</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Hora</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 font-medium">Pagamento</th>
                  <th className="px-4 py-2 font-medium text-right">Entrada</th>
                  <th className="px-4 py-2 font-medium text-right">Saída</th>
                  <th className="px-4 py-2 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {activeMovements.map((m: any) => {
                  const isEntry = m?.type === 'ENTRADA' || m?.type === 'SUPRIMENTO' || (m?.type === 'ESTORNO' && (m?.amount ?? 0) > 0);
                  const isExit = !isEntry;
                  const amt = Math.abs(m?.amount ?? 0);
                  return (
                    <tr key={m?.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500">{formatDateTime(m?.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          m?.type === 'ESTORNO' ? 'bg-purple-100 text-purple-700' :
                          isEntry ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {MOVE_TYPE_LABELS[m?.type] ?? m?.type}
                        </span>
                      </td>
                      <td className="px-4 py-2">{m?.description}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{m?.paymentMethod || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {isEntry ? <span className="text-green-600">+{formatCurrency(amt)}</span> : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {isExit ? <span className="text-red-600">-{formatCurrency(amt)}</span> : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {/* Comprovante */}
                          {m?.attachmentUrl ? (
                            <>
                              <button
                                onClick={() => handleViewAttachment(m?.id)}
                                className="text-green-600 hover:text-green-800 p-1 rounded" title="Ver comprovante"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleAttach(m?.id)}
                                disabled={uploadingId === m?.id}
                                className="text-gray-400 hover:text-[#2B7DB7] p-1 rounded disabled:opacity-50" title="Trocar comprovante"
                              >
                                {uploadingId === m?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAttach(m?.id)}
                              disabled={uploadingId === m?.id}
                              className="text-gray-400 hover:text-[#2B7DB7] p-1 rounded disabled:opacity-50" title="Anexar comprovante"
                            >
                              {uploadingId === m?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                            </button>
                          )}
                          {/* Estorno */}
                          {m?.type !== 'ESTORNO' && (
                            <button
                              onClick={() => { setShowReverse(m?.id); setReverseReason(''); }}
                              className="text-orange-600 hover:text-orange-800 p-1 rounded" title="Estornar"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr className="border-t-2">
                  <td colSpan={4} className="px-4 py-2 text-right text-sm">Total do dia</td>
                  <td className="px-4 py-2 text-right font-mono text-green-600">+{formatCurrency(reg?.totalEntradas)}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">-{formatCurrency(reg?.totalSaidas)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-right text-sm">Saldo Sistema</td>
                  <td className={`px-4 py-2 text-right font-mono font-bold text-lg ${(reg?.currentBalance ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(reg?.currentBalance)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Conferência / Caixa Balcão — abaixo do Saldo Sistema */}
      {isOpen && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <h3 className="font-semibold text-[#1E3A5F] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Conferência / Caixa Balcão
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Responsável</label>
              <input
                value={closeResponsible}
                onChange={(e) => setCloseResponsible(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Conferido (R$)</label>
              <input
                type="number"
                step="0.01"
                value={countedBalance}
                onChange={(e) => setCountedBalance(e.target.value)}
                placeholder="Conte o dinheiro e informe"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Diferença</label>
              <div className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold ${
                difference === null ? 'text-gray-400 bg-gray-50' :
                Math.abs(difference) < 0.01 ? 'text-green-600 bg-green-50 border-green-200' :
                'text-red-600 bg-red-50 border-red-200'
              }`}>
                {difference === null ? '—' : formatCurrency(difference)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observação</label>
              <input
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder={difference !== null && Math.abs(difference) >= 0.01 ? 'Obrigatório (há diferença)' : 'Opcional'}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none ${
                  difference !== null && Math.abs(difference) >= 0.01 ? 'border-red-300' : ''
                }`}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={saveCash} disabled={saving} className="bg-[#2B7DB7] hover:bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> Salvar Conferência
            </button>
            {isAdmin && (
              <button onClick={() => { setShowClose(true); setCountedBalance(''); setClosingNotes(''); }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                <Lock className="w-4 h-4" /> Fechar Caixa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Movimentações Estornadas */}
      {isOpen && cancelledMovements.length > 0 && (
        <div className="bg-white rounded-xl p-5 opacity-70" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Ban className="w-5 h-5" /> Movimentações Estornadas ({cancelledMovements.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-400 text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Hora</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 font-medium">Motivo Estorno</th>
                  <th className="px-4 py-2 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {cancelledMovements.map((m: any) => (
                  <tr key={m?.id} className="border-t line-through text-gray-400">
                    <td className="px-4 py-2 text-xs">{formatDateTime(m?.createdAt)}</td>
                    <td className="px-4 py-2">{MOVE_TYPE_LABELS[m?.type] ?? m?.type}</td>
                    <td className="px-4 py-2">{m?.description}</td>
                    <td className="px-4 py-2 text-xs no-underline italic">{m?.cancelReason}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(m?.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === MODAIS === */}

      {/* Abrir Caixa */}
      {showOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h2 className="text-lg font-bold text-[#1E3A5F] mb-4 flex items-center gap-2">
              <DoorOpen className="w-5 h-5" /> Abrir Caixa
            </h2>
            {lastClosedBalance !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">Saldo do fechamento anterior: <strong className="text-lg">{formatCurrency(lastClosedBalance)}</strong></p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Responsável</label>
                <input
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Nome do responsável"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Saldo Anterior (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowOpen(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={openCash} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Abrir Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fechar Caixa */}
      {showClose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h2 className="text-lg font-bold text-[#1E3A5F] mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" /> Fechar Caixa Diário
            </h2>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">Saldo do sistema: <strong className="text-lg">{formatCurrency(systemBalance)}</strong></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Responsável</label>
                <input value={closeResponsible} onChange={(e) => setCloseResponsible(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor Conferido (R$) *</label>
                <input type="number" step="0.01" value={countedBalance} onChange={(e) => setCountedBalance(e.target.value)} placeholder="Conte o dinheiro e informe aqui" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none" />
              </div>

              {difference !== null && (
                <div className={`rounded-lg p-3 ${
                  Math.abs(difference) < 0.01 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className="text-sm font-medium">
                    Diferença: <span className={`font-mono font-bold text-lg ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(difference)}
                    </span>
                  </p>
                  {Math.abs(difference) >= 0.01 && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Há diferença. A observação é obrigatória.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Observação {difference !== null && Math.abs(difference) >= 0.01 ? '*' : ''}
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2B7DB7] outline-none resize-none"
                  placeholder={difference !== null && Math.abs(difference) >= 0.01 ? 'Explique a diferença...' : 'Observação opcional'}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowClose(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={closeCash} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reabrir Caixa */}
      {showReopen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h2 className="text-lg font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Unlock className="w-5 h-5" /> Reabrir Último Caixa
            </h2>
            {lastClosedInfo?.closeDate && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-orange-800 font-medium mb-1">Caixa que será reaberto:</p>
                <p className="text-xs text-orange-700">📅 Fechado em: <strong>{new Date(lastClosedInfo.closeDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date(lastClosedInfo.closeDate).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</strong></p>
                {lastClosedInfo.responsible && <p className="text-xs text-orange-700">👤 Responsável: <strong>{lastClosedInfo.responsible}</strong></p>}
                {lastClosedBalance !== null && <p className="text-xs text-orange-700">💰 Saldo: <strong>{formatCurrency(lastClosedBalance)}</strong></p>}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">O caixa acima será reaberto. Informe o motivo:</p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              placeholder="Motivo da reabertura... *"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReopen(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={reopenCash} disabled={saving || !reopenReason.trim()} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Reabrir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Comprovante */}
      {viewAttachment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setViewAttachment(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-4" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Comprovante
              </h2>
              <button onClick={() => setViewAttachment(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {viewAttachment.contentType.startsWith('image/') ? (
              <img src={viewAttachment.url} alt="Comprovante" className="w-full rounded-lg" />
            ) : (
              <iframe src={viewAttachment.url} className="w-full h-[70vh] rounded-lg border" />
            )}
          </div>
        </div>
      )}

      {/* Estorno */}
      {showReverse && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h2 className="text-lg font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Estornar Movimentação
            </h2>
            <p className="text-sm text-gray-500 mb-3">A movimentação será cancelada e um lançamento inverso criado.</p>
            <textarea
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              rows={3}
              placeholder="Motivo do estorno... *"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReverse(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={reverseMovement} disabled={saving || !reverseReason.trim()} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Confirmar Estorno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
