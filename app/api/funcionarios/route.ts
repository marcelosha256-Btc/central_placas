export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upper } from '@/lib/utils';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/password';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        cpf: true,
        active: true,
        commissionRate: true,
        discountLimit: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('[FUNCIONARIOS] GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { name, email, password, role, phone, cpf, active, commissionRate, discountLimit } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Senha fraca: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 400 });
    }

    const cpfClean = (cpf || '').replace(/\D/g, '');
    if (cpfClean) {
      const existingCpf = await prisma.user.findFirst({ where: { cpf: cpfClean } });
      if (existingCpf) {
        return NextResponse.json({ error: 'CPF já cadastrado para outro funcionário' }, { status: 400 });
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: upper(name),
        email,
        password: hashed,
        role: role || 'vendedor',
        phone: phone || '',
        cpf: cpfClean,
        active: active !== false,
        commissionRate: commissionRate || 0,
        discountLimit: discountLimit || 0,
      },
    });

    return NextResponse.json({ success: true, id: user.id });
  } catch (err: any) {
    console.error('[FUNCIONARIOS] POST error:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao criar' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id, name, email, password, role, phone, cpf, active, commissionRate, discountLimit } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const data: any = {};
    if (name !== undefined) data.name = upper(name);
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (phone !== undefined) data.phone = phone;
    if (active !== undefined) data.active = active;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (discountLimit !== undefined) data.discountLimit = discountLimit;

    if (cpf !== undefined) {
      const cpfClean = (cpf || '').replace(/\D/g, '');
      if (cpfClean) {
        const existingCpf = await prisma.user.findFirst({ where: { cpf: cpfClean, NOT: { id } } });
        if (existingCpf) {
          return NextResponse.json({ error: 'CPF já cadastrado para outro funcionário' }, { status: 400 });
        }
      }
      data.cpf = cpfClean;
    }

    if (password) {
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: `Senha fraca: ${pwCheck.errors.join(', ')}` }, { status: 400 });
      }
      data.password = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FUNCIONARIOS] PUT error:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await prisma.user.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FUNCIONARIOS] DELETE error:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao desativar' }, { status: 500 });
  }
}
