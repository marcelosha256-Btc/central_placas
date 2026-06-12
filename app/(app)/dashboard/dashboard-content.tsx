'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DollarSign, ShoppingCart, Wallet, Plus, ArrowRight, Loader2, Car, Bike, AlertTriangle, Receipt, MessageCircle, TrendingUp, TrendingDown, ChevronRight, Target, BarChart2, Users, CreditCard, Package } from 'lucide-react';
import { formatCurrency, STATUS_LABELS, STATUS_COLORS, formatDateTime, formatDate } from '@/lib/utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const GoalChart = dynamic(() => import('./goal-chart'), { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> });
const MixChart = dynamic(() => import('./mix-chart'), { ssr: false, loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> });

// Monta link de cobrança via WhatsApp com mensagem pronta
function waLink(whatsapp: string, name: string, invoiceNumber: string, amount: number, daysLate: number) {
  const digits = (whatsapp || '').replace(/\D/g, '');
  if (!digits) return '';
  const phone = digits.length <= 11 ? `55${digits}` : digits;
  const msg = `Olá, ${name}! Aqui é da CENTRAL.PLACAS. Passando para lembrar da fatura ${invoiceNumber} no valor de ${formatCurrency(amount)}, vencida há ${daysLate} dia(s). Qualquer dúvida estamos à disposição!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function DashboardContent() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setUpdatedAt(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2B7DB7]" />
      </div>
    );
  }

  const p = data?.platesToday ?? { pares: 0, motos: 0, dianteiras: 0, traseiras: 0, total: 0 };

  // Saudação contextual
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = nowBR.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = (session?.user?.name || '').split(' ')[0];
  const fullDate = nowBR.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Tendência: hoje vs média dos 6 dias anteriores
  const chart = data?.chartData ?? [];
  const prevDays = chart.slice(0, -1).map((d: any) => d.total);
  const avg = prevDays.length ? prevDays.reduce((s: number, v: number) => s + v, 0) / prevDays.length : 0;
  const todayTotal = data?.salesTodayAmount ?? 0;
  const trendPct = avg > 0 ? Math.round(((todayTotal - avg) / avg) * 100) : 0;

  const overdueList = data?.overdueList ?? [];

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] font-display tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="capitalize">{fullDate}</span>
            {updatedAt && <span className="text-gray-400"> · atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pedidos?novo=1" className="bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Novo Pedido
          </Link>
        </div>
      </div>

      {/* Alerta de estoque baixo */}
      {(data?.lowStockCount ?? 0) > 0 && (
        <Link href="/estoque" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {data.lowStockCount} {data.lowStockCount === 1 ? 'produto está' : 'produtos estão'} com estoque baixo
            </p>
            {(data?.lowStockNames ?? []).length > 0 && (
              <p className="text-xs text-amber-700/80 truncate">{(data.lowStockNames ?? []).join(' · ')}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
        </Link>
      )}

      {/* ===== BLOCO 1 — Operação do dia ===== */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Operação do dia</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Placas de Hoje — hero com gradiente */}
          <div className="rounded-xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2B7DB7 100%)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 top-14 w-16 h-16 rounded-full bg-white/10" />
            <div className="flex items-center justify-between mb-3 relative">
              <p className="text-sm text-white/80">Placas de Hoje</p>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">{p.total} total</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center relative">
              <div className="bg-white/10 backdrop-blur rounded-lg py-2.5">
                <Car className="w-5 h-5 mx-auto text-white/90" />
                <p className="text-2xl font-bold mt-1 font-mono">{p.pares}</p>
                <p className="text-[10px] text-white/70 uppercase tracking-wide">Pares</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg py-2.5">
                <Bike className="w-5 h-5 mx-auto text-white/90" />
                <p className="text-2xl font-bold mt-1 font-mono">{p.motos}</p>
                <p className="text-[10px] text-white/70 uppercase tracking-wide">Motos</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg py-2.5">
                <span className="text-base leading-5">🔲</span>
                <p className="text-2xl font-bold mt-1 font-mono">{p.dianteiras + p.traseiras}</p>
                <p className="text-[10px] text-white/70 uppercase tracking-wide">Avulsas</p>
              </div>
            </div>
          </div>

          {/* Vendas de Hoje — com tendência vs média */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-5 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div>
              <p className="text-sm text-gray-500">Vendas de Hoje</p>
              <p className="text-2xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(todayTotal)}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">{data?.salesTodayCount ?? 0} pedidos</p>
                {avg > 0 && trendPct !== 0 && (
                  <span className={`text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${trendPct > 0 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {trendPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(trendPct)}% vs média 7d
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700"><DollarSign className="w-5 h-5" /></div>
          </div>

          {/* Saldo do Caixa */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-5 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div>
              <p className="text-sm text-gray-500">Saldo do Caixa</p>
              <p className="text-2xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(data?.cashBalance ?? 0)}</p>
              <p className={`text-xs mt-1 font-medium ${data?.cashOpen ? 'text-green-600' : 'text-red-500'}`}>{data?.cashOpen ? '● Caixa aberto' : '● Caixa fechado'}</p>
            </div>
            <div className={`p-2.5 rounded-lg ${data?.cashOpen ? 'bg-sky-100 text-sky-700' : 'bg-red-100 text-red-600'}`}><Wallet className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* ===== BLOCO 2 — Cobrança e pendências ===== */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Cobrança e pendências</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pedidos em Aberto */}
          <Link href="/financeiro/contas-receber" className="bg-amber-50/70 border border-amber-100 rounded-xl p-5 flex items-start justify-between transition-all hover:translate-y-[-2px]" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div>
              <p className="text-sm text-gray-500">Pedidos em Aberto</p>
              <p className="text-2xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(data?.pendingAmount ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{data?.pendingOrders ?? 0} pedido(s) · balcão</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700"><ShoppingCart className="w-5 h-5" /></div>
          </Link>

          {/* Inadimplência — abre o drawer */}
          <button
            onClick={() => setOverdueOpen(true)}
            className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 flex items-start justify-between transition-all hover:translate-y-[-2px] text-left cursor-pointer"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                Inadimplência
                {(data?.overdueCount ?? 0) > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              </p>
              <p className={`text-2xl font-bold mt-1 font-mono ${(data?.overdueAmount ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(data?.overdueAmount ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {data?.overdueCount ?? 0} fatura(s) vencida(s)
                {(data?.overdueCount ?? 0) > 0 && <span className="text-red-500 font-medium flex items-center">· ver lista <ChevronRight className="w-3 h-3" /></span>}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-600"><AlertTriangle className="w-5 h-5" /></div>
          </button>

          {/* Contas a Pagar Hoje */}
          <Link href="/financeiro/contas-pagar" className="bg-orange-50/70 border border-orange-100 rounded-xl p-5 flex items-start justify-between transition-all hover:translate-y-[-2px]" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div>
              <p className="text-sm text-gray-500">Contas a Pagar</p>
              <p className={`text-2xl font-bold mt-1 font-mono ${(data?.payablesAmount ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(data?.payablesAmount ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{data?.payablesCount ?? 0} vencendo / atrasada(s)</p>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-100 text-orange-700"><Receipt className="w-5 h-5" /></div>
          </Link>
        </div>
      </div>

      {/* ===== Drawer de Inadimplência ===== */}
      <Sheet open={overdueOpen} onOpenChange={setOverdueOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#1E3A5F] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Clientes em Atraso
            </SheetTitle>
            <SheetDescription>
              {overdueList.length > 0
                ? `${overdueList.length} fatura(s) vencida(s) — total ${formatCurrency(data?.overdueAmount ?? 0)}`
                : 'Nenhuma fatura vencida. Tudo em dia! 🎉'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-3">
            {overdueList.map((c: any, i: number) => {
              const link = waLink(c.whatsapp, c.name, c.invoiceNumber, c.amount, c.daysLate);
              return (
                <div key={i} className="border border-red-100 bg-red-50/40 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1E3A5F] text-sm truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Fatura {c.invoiceNumber} · venceu {formatDate(c.dueDate)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {c.daysLate}d atraso
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="font-mono font-bold text-red-600">{formatCurrency(c.amount)}</p>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Lembrete
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-400">sem WhatsApp</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {overdueList.length > 0 && (
            <Link
              href="/financeiro/faturamento"
              className="mt-5 w-full bg-[#1E3A5F] hover:bg-[#2B7DB7] text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
              onClick={() => setOverdueOpen(false)}
            >
              Ir para o Faturamento <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== BLOCO 3 — Estoque de Chapas (todos os roles) ===== */}
      {(data?.stockSnapshot ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Insumos</p>
          <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#1E3A5F] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#2B7DB7]" /> Chapas em Estoque
              </h3>
              <Link href="/estoque" className="text-xs text-[#2B7DB7] hover:underline flex items-center gap-1">
                Gerenciar <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {(data.stockSnapshot as any[]).map((p: any) => {
                const isRed = p.overCommitted || p.orderUrgent;
                const isAmber = !isRed && p.orderSoon;
                return (
                  <div key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isRed ? 'bg-red-50 border border-red-100' : isAmber ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                    <div>
                      <p className="text-sm font-medium text-[#1E3A5F]">{p.description}</p>
                      <p className="text-xs text-gray-400">
                        {p.committedQty > 0 && <span className="text-amber-600">{p.committedQty} comprom. · </span>}
                        {p.stockQuantity} físico{p.dailyAvg > 0 ? ` · ${p.dailyAvg}/dia` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-mono font-bold text-sm ${isRed ? 'text-red-600' : 'text-[#1E3A5F]'}`}>{p.availableQty} un</p>
                        <p className="text-[10px] text-gray-400">disponível</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${p.overCommitted ? 'bg-red-200 text-red-800' : p.orderUrgent ? 'bg-red-100 text-red-700' : p.orderSoon ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {p.overCommitted ? 'Insuficiente' : p.daysRemaining !== null ? `${p.daysRemaining}d` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Chart + Mix de Receita — somente admin */}
      {session?.user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 lg:col-span-2" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-semibold text-[#1E3A5F]">Meta de Produção</h3>
                <p className="text-xs text-gray-400">1.000 placas / mês · traço cinza = ritmo esperado</p>
              </div>
            </div>
            <div className="h-64">
              <GoalChart platesMonth={data?.platesMonth ?? 0} />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 flex flex-col" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-semibold text-[#1E3A5F] mb-2">Mix de Receita</h3>
            <p className="text-xs text-gray-400 mb-2">Balcão (à vista) vs Carteira (fatura mensal)</p>
            <div className="flex-1">
              <MixChart balcao={data?.mixBalcao ?? 0} frota={data?.mixFrota ?? 0} />
            </div>
          </div>
        </div>
      )}

      {/* ===== Admin: Visão Financeira ===== */}
      {session?.user?.role === 'admin' && (() => {
        const monthRevenue = data?.monthRevenue ?? 0;
        const prevMonthRevenue = data?.prevMonthRevenue ?? 0;
        const revenueGrowth = prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : null;
        const monthExpenses = data?.monthExpenses ?? 0;
        const resultado = monthRevenue - monthExpenses;
        const topClients: any[] = data?.topClients ?? [];
        const medals = ['🥇', '🥈', '🥉', '4°', '5°'];

        return (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Visão Financeira</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Receita do Mês */}
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Receita do Mês</p>
                    <p className="text-xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(monthRevenue)}</p>
                    {revenueGrowth !== null && (
                      <span className={`text-[11px] font-semibold flex items-center gap-0.5 mt-1 ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {revenueGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}% vs mês ant.
                      </span>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 shrink-0"><BarChart2 className="w-4 h-4" /></div>
                </div>

                {/* Ticket Médio */}
                <div className="bg-violet-50/70 border border-violet-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <div>
                    <p className="text-xs text-gray-500">Ticket Médio</p>
                    <p className="text-xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(data?.avgTicket ?? 0)}</p>
                    <p className="text-[11px] text-gray-400 mt-1">por pedido</p>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-100 text-violet-600 shrink-0"><DollarSign className="w-4 h-4" /></div>
                </div>

                {/* Projeção de Fechamento */}
                <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <div>
                    <p className="text-xs text-gray-500">Projeção Mensal</p>
                    <p className="text-xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(data?.projectedRevenue ?? 0)}</p>
                    <p className="text-[11px] text-gray-400 mt-1">se manter o ritmo</p>
                  </div>
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-600 shrink-0"><Target className="w-4 h-4" /></div>
                </div>

                {/* Despesas do Mês */}
                <div className="bg-red-50/70 border border-red-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <div>
                    <p className="text-xs text-gray-500">Despesas do Mês</p>
                    <p className="text-xl font-bold text-red-600 mt-1 font-mono">{formatCurrency(monthExpenses)}</p>
                    <p className="text-[11px] text-gray-400 mt-1">lançadas no mês</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0"><CreditCard className="w-4 h-4" /></div>
                </div>
              </div>

              {/* Resultado estimado */}
              <div className="mt-3 bg-white rounded-xl px-5 py-3 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                <span className="text-xs text-gray-500">
                  Receita <span className="font-mono font-semibold text-[#1E3A5F]">{formatCurrency(monthRevenue)}</span>
                  {' − '}
                  Despesas <span className="font-mono font-semibold text-red-500">{formatCurrency(monthExpenses)}</span>
                </span>
                <span className={`font-mono font-bold text-base ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  = {formatCurrency(resultado)}
                </span>
              </div>

              {/* Estoque · Insumos (admin) */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Estoque · Insumos</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <div>
                      <p className="text-xs text-gray-500">Valor em Estoque</p>
                      <p className="text-xl font-bold text-[#1E3A5F] mt-1 font-mono">{formatCurrency(data?.stockValue ?? 0)}</p>
                      <p className="text-[11px] text-gray-400 mt-1">custo médio ponderado</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0"><Package className="w-4 h-4" /></div>
                  </div>
                  <div className="bg-orange-50/70 border border-orange-100 rounded-xl p-4 flex items-start justify-between" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <div>
                      <p className="text-xs text-gray-500">Compras no Mês</p>
                      <p className={`text-xl font-bold mt-1 font-mono ${(data?.stockSpentThisMonth ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatCurrency(data?.stockSpentThisMonth ?? 0)}</p>
                      <p className="text-[11px] text-gray-400 mt-1">entradas de chapas</p>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 shrink-0"><CreditCard className="w-4 h-4" /></div>
                  </div>
                  <div className={`rounded-xl p-4 flex items-start justify-between border ${data?.avgEfficiency === null ? 'bg-gray-50/70 border-gray-100' : (data?.avgEfficiency ?? 0) >= 95 ? 'bg-green-50/70 border-green-100' : (data?.avgEfficiency ?? 0) >= 85 ? 'bg-amber-50/70 border-amber-100' : 'bg-red-50/70 border-red-100'}`} style={{ boxShadow: 'var(--shadow-md)' }}>
                    <div>
                      <p className="text-xs text-gray-500">Aproveitamento</p>
                      <p className={`text-xl font-bold mt-1 font-mono ${data?.avgEfficiency === null ? 'text-gray-400' : (data?.avgEfficiency ?? 0) >= 95 ? 'text-green-600' : (data?.avgEfficiency ?? 0) >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                        {data?.avgEfficiency !== null && data?.avgEfficiency !== undefined ? `${data.avgEfficiency}%` : '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">saídas vs avarias (60d)</p>
                    </div>
                    <div className={`p-2 rounded-lg shrink-0 ${data?.avgEfficiency === null ? 'bg-gray-100 text-gray-400' : (data?.avgEfficiency ?? 0) >= 95 ? 'bg-green-100 text-green-600' : (data?.avgEfficiency ?? 0) >= 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}><BarChart2 className="w-4 h-4" /></div>
                  </div>
                </div>
                {/* Próximas reposições */}
                {(data?.stockSnapshot ?? []).some((p: any) => p.dailyAvg > 0) && (
                  <div className="mt-3 bg-white rounded-xl px-5 py-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <p className="text-xs font-medium text-gray-500 mb-2">Próximas Reposições</p>
                    <div className="space-y-2">
                      {(data.stockSnapshot as any[]).filter((p: any) => p.dailyAvg > 0).map((p: any) => {
                        const daysUntil = p.daysRemaining !== null ? Math.max(0, p.daysRemaining - p.leadTimeDays) : null;
                        const suggestedQty = Math.ceil(p.dailyAvg * 30);
                        return (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <p className="font-medium text-[#1E3A5F]">{p.description}</p>
                            <p className={`text-xs font-medium ${daysUntil !== null && daysUntil <= 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {daysUntil === null ? '—' : daysUntil <= 0 ? 'Pedir agora!' : `Pedir em ~${daysUntil}d · ~${suggestedQty} un`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== Bloco 4 — Top Clientes ===== */}
            {topClients.length > 0 && (
              <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-[#2B7DB7]" />
                  <h3 className="font-semibold text-[#1E3A5F]">Top Clientes do Mês</h3>
                </div>
                <div className="space-y-2">
                  {topClients.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-base w-6 text-center shrink-0">{medals[i] ?? `${i + 1}°`}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#1E3A5F] truncate">{c.name}</p>
                          <p className="font-mono font-bold text-sm text-[#1E3A5F] shrink-0">{formatCurrency(c.revenue)}</p>
                        </div>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2B7DB7]"
                            style={{ width: `${Math.round((c.revenue / (topClients[0]?.revenue || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">{c.orders} ped.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Recent Orders — somente admin */}
      {session?.user?.role === 'admin' && (
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#1E3A5F]">Últimos Pedidos</h3>
            <Link href="/pedidos" className="text-sm text-[#2B7DB7] hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Valor</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {(data?.latestOrders ?? [])?.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhum pedido encontrado</td></tr>
                )}
                {(data?.latestOrders ?? [])?.map((o: any) => (
                  <tr key={o?.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 font-mono text-xs">#{o?.orderNumber}</td>
                    <td className="py-2.5">{o?.customerName}</td>
                    <td className="py-2.5 font-mono">{formatCurrency(o?.totalAmount)}</td>
                    <td className="py-2.5">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o?.status] ?? ''}`}>
                        {STATUS_LABELS[o?.status] ?? o?.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{formatDateTime(o?.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
