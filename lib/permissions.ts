/**
 * Sistema de permissões por cargo (RBAC simplificado).
 * Cada role tem uma lista de módulos que pode acessar.
 * O middleware e a sidebar consultam este mapa.
 */

export const ROLES = ['admin', 'vendedor', 'caixa'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  caixa: 'Operador de Caixa',
};

/**
 * Módulos do sistema — cada string corresponde ao prefixo da rota.
 * Ex: 'pedidos' protege /pedidos e /api/orders
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'dashboard',
    'pedidos',
    'clientes',
    'produtos',
    'tabelas-preco',
    'estoque',
    'financeiro',
    'relatorios',
    'auditoria',
    'funcionarios',
  ],
  vendedor: [
    'dashboard',
    'pedidos',
    'clientes',
    'produtos',
    'tabelas-preco',
  ],
  caixa: [
    'dashboard',
    'pedidos',
    'estoque',
    'financeiro',
    'relatorios',
  ],
};

/**
 * Mapeamento de rotas de API para módulo.
 * Usado no middleware para checar permissão.
 */
export const API_ROUTE_MODULE: Record<string, string> = {
  '/api/orders': 'pedidos',
  '/api/customers': 'clientes',
  '/api/products': 'produtos',
  '/api/price-tables': 'tabelas-preco',
  '/api/stock': 'estoque',
  '/api/invoices': 'financeiro',
  '/api/cash': 'financeiro',
  '/api/expenses': 'financeiro',
  '/api/payments': 'financeiro',
  '/api/receivables': 'financeiro',
  '/api/relatorios/auditoria': 'auditoria',
  '/api/relatorios': 'relatorios',
  '/api/envio-mensal': 'relatorios',
  '/api/dashboard': 'dashboard',
  '/api/funcionarios': 'funcionarios',
};

/**
 * Mapeamento de rotas de página para módulo.
 */
export const PAGE_ROUTE_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/pedidos': 'pedidos',
  '/clientes': 'clientes',
  '/produtos': 'produtos',
  '/tabelas-preco': 'tabelas-preco',
  '/estoque': 'estoque',
  '/financeiro': 'financeiro',
  '/relatorios/auditoria': 'auditoria',
  '/relatorios': 'relatorios',
  '/funcionarios': 'funcionarios',
};

/**
 * Verifica se um role tem permissão para acessar um módulo.
 */
export function hasPermission(role: string | undefined | null, module: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(module);
}

/**
 * Dado um pathname, retorna o módulo correspondente (ou null se público/auth).
 */
export function getModuleFromPath(pathname: string): string | null {
  // API routes
  for (const [prefix, mod] of Object.entries(API_ROUTE_MODULE)) {
    if (pathname.startsWith(prefix)) return mod;
  }
  // Page routes
  for (const [prefix, mod] of Object.entries(PAGE_ROUTE_MODULE)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod;
  }
  return null;
}
