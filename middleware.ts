import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { ROLE_PERMISSIONS, API_ROUTE_MODULE, PAGE_ROUTE_MODULE } from '@/lib/permissions';

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

    // Se não mapeou nenhum módulo, permite (rota pública/auth)
    if (!module) return NextResponse.next();

    const perms = ROLE_PERMISSIONS[role];
    if (!perms || !perms.includes(module)) {
      // API: retorna 403
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Sem permissão para acessar este recurso' },
          { status: 403 }
        );
      }
      // Página: redireciona para dashboard (que todos podem acessar)
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
