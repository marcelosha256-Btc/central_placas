import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'pedidos', 'clientes', 'produtos', 'tabelas-preco', 'estoque', 'financeiro', 'relatorios', 'auditoria', 'funcionarios'],
  vendedor: ['dashboard', 'pedidos', 'clientes', 'produtos', 'tabelas-preco'],
  caixa: ['dashboard', 'pedidos', 'estoque', 'financeiro', 'relatorios'],
};

const API_ROUTE_MODULE: Record<string, string> = {
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

const PAGE_ROUTE_MODULE: Record<string, string> = {
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

function getModuleFromPath(pathname: string): string | null {
  for (const [prefix, mod] of Object.entries(API_ROUTE_MODULE)) {
    if (pathname.startsWith(prefix)) return mod;
  }
  for (const [prefix, mod] of Object.entries(PAGE_ROUTE_MODULE)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod;
  }
  return null;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = (token?.role as string) || '';
    const pathname = req.nextUrl.pathname;

    const module = getModuleFromPath(pathname);

    if (!module) return NextResponse.next();

    const perms = ROLE_PERMISSIONS[role];
    if (!perms || !perms.includes(module)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Sem permissão para acessar este recurso' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clientes/:path*',
    '/produtos/:path*',
    '/pedidos/:path*',
    '/financeiro/:path*',
    '/relatorios/:path*',
    '/tabelas-preco/:path*',
    '/estoque/:path*',
    '/funcionarios/:path*',
    '/api/customers/:path*',
    '/api/products/:path*',
    '/api/orders/:path*',
    '/api/cash/:path*',
    '/api/expenses/:path*',
    '/api/payments/:path*',
    '/api/invoices/:path*',
    '/api/dashboard/:path*',
    '/api/price-tables/:path*',
    '/api/stock/:path*',
    '/api/receivables/:path*',
    '/api/relatorios/:path*',
    '/api/envio-mensal/:path*',
    '/api/funcionarios/:path*',
  ],
};
