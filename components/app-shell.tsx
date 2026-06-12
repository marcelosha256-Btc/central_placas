'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ClipboardList,
  Tag,
  FileBarChart,
} from 'lucide-react';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@/lib/permissions';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart, module: 'pedidos' },
  { href: '/estoque', label: 'Estoque', icon: Package, module: 'estoque' },
  {
    label: 'Financeiro',
    icon: DollarSign,
    groupKey: 'financeiro',
    module: 'financeiro',
    children: [
      { href: '/financeiro/caixa', label: 'Caixa', module: 'financeiro' },
      { href: '/financeiro/faturamento', label: 'Faturamento', module: 'financeiro' },
      { href: '/financeiro/contas-receber', label: 'Contas a Receber', module: 'financeiro' },
      { href: '/financeiro/contas-pagar', label: 'Contas a Pagar', module: 'financeiro' },
    ],
  },
  {
    label: 'Relatórios',
    icon: FileBarChart,
    groupKey: 'relatorios',
    module: 'relatorios',
    children: [
      { href: '/relatorios/mensal', label: 'Extrato de Clientes', module: 'relatorios' },
      { href: '/relatorios/caixa', label: 'Relatório de Caixa', module: 'relatorios' },
      { href: '/relatorios/auditoria', label: 'Auditoria de Pedidos', module: 'auditoria' },
      { href: '/relatorios/descontos', label: 'Descontos Concedidos', module: 'relatorios' },
    ],
  },
  {
    label: 'Cadastros',
    icon: ClipboardList,
    groupKey: 'cadastro',
    children: [
      { href: '/clientes', label: 'Clientes', module: 'clientes' },
      { href: '/tabelas-preco', label: 'Tabelas de Preço', module: 'tabelas-preco' },
      { href: '/produtos', label: 'Produtos', module: 'produtos' },
      { href: '/funcionarios', label: 'Funcionários', module: 'funcionarios' },
    ],
  },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: any }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userRole = (user?.role as string) || 'admin';
  const perms = ROLE_PERMISSIONS[userRole] || [];

  // Filter nav items based on user permissions
  const navItems = useMemo(() => {
    return allNavItems
      .map((item: any) => {
        if (item.children) {
          const filteredChildren = item.children.filter((c: any) => perms.includes(c.module));
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        if (item.module && !perms.includes(item.module)) return null;
        return item;
      })
      .filter(Boolean);
  }, [perms]);

  const isCadastroChild = pathname === '/clientes' || pathname === '/produtos' || pathname?.startsWith('/tabelas-preco') || pathname === '/funcionarios';
  const isFinanceiroChild = pathname?.startsWith('/financeiro');
  const isRelatoriosChild = pathname?.startsWith('/relatorios');

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    cadastro: isCadastroChild,
    financeiro: isFinanceiroChild,
    relatorios: isRelatoriosChild,
  });

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const roleLabel = ROLE_LABELS[userRole] || userRole;

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(210,20%,98%)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1E3A5F] text-white flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link href="/dashboard" className="text-xl font-bold font-display tracking-tight">
            CENTRAL<span className="text-blue-300">.PLACAS</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems?.map((item: any, i: number) => {
            if (item?.children) {
              const groupKey = item.groupKey ?? `group-${i}`;
              const isOpen = !!openGroups[groupKey];
              const isChildActive = item.children?.some((c: any) => isActive(c?.href));
              return (
                <div key={i}>
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isChildActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{item?.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children?.map((child: any) => (
                        <Link
                          key={child?.href}
                          href={child?.href ?? '#'}
                          onClick={() => setSidebarOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive(child?.href) ? 'bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {child?.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item?.href}
                href={item?.href ?? '#'}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item?.href) ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item?.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/50 mb-1 truncate">{user?.name ?? user?.email ?? 'Usuário'}</div>
          <div className="text-[10px] text-blue-300/60 mb-2">{roleLabel}</div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3 lg:px-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400 hidden sm:block">{roleLabel}</span>
          <span className="text-sm text-gray-500 hidden sm:block">{user?.name ?? user?.email ?? ''}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1200px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
