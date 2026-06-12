export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upper } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const all = searchParams.get('all');

  if (all === '1') {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: { priceTable: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } },
    });
    return NextResponse.json(customers);
  }

  const where: any = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as any } },
          { document: { contains: search.replace(/\D/g, '') } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { priceTable: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ customers, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, personType, document, phone, whatsapp, email, cep, street, number, complement, neighborhood, city, state, priceTableId, sellerId, monthlyReport, reportType, paymentTerm } = body ?? {};
    if (!name || !document) {
      return NextResponse.json({ error: 'Nome e documento são obrigatórios' }, { status: 400 });
    }
    const existing = await prisma.customer.findUnique({ where: { document: document.replace(/\D/g, '') } });
    if (existing) {
      return NextResponse.json({ error: 'Documento já cadastrado' }, { status: 409 });
    }
    const customer = await prisma.customer.create({
      data: {
        name: upper(name), personType: personType ?? 'PF', document: document.replace(/\D/g, ''),
        phone: phone ?? '', whatsapp: whatsapp ?? '', email: email ?? '',
        cep: cep ?? '', street: upper(street ?? ''), number: number ?? '',
        complement: upper(complement ?? ''), neighborhood: upper(neighborhood ?? ''),
        city: upper(city ?? ''), state: upper(state ?? ''),
        priceTableId: priceTableId || null,
        sellerId: sellerId || null,
        monthlyReport: monthlyReport ?? false,
        reportType: reportType || 'detalhado',
        paymentTerm: paymentTerm || 'AVISTA',
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, personType, document, phone, whatsapp, email, cep, street, number, complement, neighborhood, city, state, priceTableId, sellerId, monthlyReport, reportType, paymentTerm } = body ?? {};
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const docClean = (document ?? '').replace(/\D/g, '');
    const dup = await prisma.customer.findFirst({ where: { document: docClean, NOT: { id } } });
    if (dup) return NextResponse.json({ error: 'Documento já cadastrado em outro cliente' }, { status: 409 });

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: upper(name), personType, document: docClean,
        phone: phone ?? '', whatsapp: whatsapp ?? '', email: email ?? '',
        cep: cep ?? '', street: upper(street ?? ''), number: number ?? '',
        complement: upper(complement ?? ''), neighborhood: upper(neighborhood ?? ''),
        city: upper(city ?? ''), state: upper(state ?? ''),
        priceTableId: priceTableId || null,
        sellerId: sellerId || null,
        monthlyReport: monthlyReport ?? false,
        reportType: reportType || 'detalhado',
        paymentTerm: paymentTerm || 'AVISTA',
      },
    });
    return NextResponse.json(customer);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  try {
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Não é possível excluir. Cliente pode ter pedidos vinculados.' }, { status: 500 });
  }
}
