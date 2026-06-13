import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

const handler = NextAuth(authOptions);

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(req: NextRequest, context: any) {
  return handler(req as any, context);
}

export async function POST(req: NextRequest, context: any) {
  if (req.nextUrl.pathname.includes('/callback/credentials')) {
    const ip = getIP(req);
    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      const minutes = Math.ceil((retryAfter ?? 900) / 60);
      return NextResponse.json(
        { error: `Muitas tentativas de login. Tente novamente em ${minutes} minutos.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter ?? 900) } }
      );
    }
  }
  return handler(req as any, context);
}
