export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { orderId, notes, paymentForms, discount: rawDiscount, discountReason } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Pedido obrigatório' }, { status: 400 });

    const discountAmount = parseFloat(String(rawDiscount)) || 0;

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: { select: { name: true } }, items: true } });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (order.deleted) return NextResponse.json({ error: 'Pedido excluído não pode receber pagamento' }, { status: 400 });

    // Validar desconto
    if (discountAmount > 0 && !discountReason?.trim()) {
      return NextResponse.json({ error: 'Informe o motivo do desconto' }, { status: 400 });
    }

    // Verificar limite de desconto do usuário
    if (discountAmount > 0) {
      const userRole = (session.user as any).role;
      if (userRole !== 'admin') {
        const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id }, select: { discountLimit: true } });
        if (discountAmount > (dbUser?.discountLimit ?? 0)) {
          return NextResponse.json({ error: `Desconto de R$ ${discountAmount.toFixed(2)} excede seu limite de R$ ${(dbUser?.discountLimit ?? 0).toFixed(2)}` }, { status: 403 });
        }
      }
    }

    // Múltiplas formas de pagamento
    if (!paymentForms || !Array.isArray(paymentForms) || paymentForms.length === 0) {
      if (discountAmount <= 0) {
        return NextResponse.json({ error: 'Informe as formas de pagamento' }, { status: 400 });
      }
    }
    const forms: Array<{ method: string; value: number }> = (paymentForms || [])
      .map((f: any) => ({ method: f.method || 'PIX', value: parseFloat(String(f.value)) || 0 }))
      .filter((f: any) => f.value > 0);

    const totalPaying = forms.reduce((sum, f) => sum + f.value, 0);
    if (totalPaying <= 0 && discountAmount <= 0) return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });

    // Verificar se há caixa aberto — bloquear se fechado (apenas se há dinheiro real)
    let openCash: any = null;
    if (totalPaying > 0) {
      openCash = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (!openCash) {
        return NextResponse.json({ error: 'Caixa fechado. Abra o caixa antes de registrar recebimentos.' }, { status: 400 });
      }
    }

    const remaining = (order?.totalAmount ?? 0) - (order?.paidAmount ?? 0);
    if ((totalPaying + discountAmount) - remaining > 0.01) {
      return NextResponse.json({ error: 'Valor recebido + desconto maior que o saldo devedor' }, { status: 400 });
    }

    // Criar um Payment para cada forma (só dinheiro real)
    const payments = [];
    for (const f of forms) {
      if (f.value <= 0) continue;
      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: f.value,
          paymentMethod: f.method,
          notes: notes ?? '',
        },
      });
      payments.push(payment);
    }

    // Atualizar valor pago do pedido (recebido + desconto quita)
    const totalSettle = totalPaying + discountAmount;
    const newPaid = (order?.paidAmount ?? 0) + totalSettle;
    const updateData: any = { paidAmount: newPaid };
    if (newPaid >= (order?.totalAmount ?? 0) - 0.01) {
      updateData.status = 'PAGO';
    }
    await prisma.order.update({ where: { id: orderId }, data: updateData });

    // Registrar entradas no caixa (só dinheiro real)
    if (openCash) {
      for (const f of forms) {
        if (f.value <= 0) continue;
        await prisma.cashMovement.create({
          data: {
            cashRegisterId: openCash.id,
            type: 'ENTRADA',
            amount: f.value,
            description: `Pedido #${order?.orderNumber} - ${(order as any)?.customer?.name || 'Cliente'}`,
            paymentMethod: f.method,
            orderId,
          },
        });
      }
    }

    // Registrar desconto
    if (discountAmount > 0) {
      await prisma.invoiceDiscount.create({
        data: {
          orderId,
          orderNumber: order.orderNumber,
          userId: (session.user as any).id,
          userName: (session.user as any).name || 'Sistema',
          customerId: order.customerId,
          customerName: (order as any).customer?.name || '',
          amount: discountAmount,
          reason: discountReason?.trim() || '',
        },
      });
    }

    // Registrar auditoria de recebimento
    const auditReason = discountAmount > 0
      ? `Recebimento de R$ ${totalPaying.toFixed(2)} + Desconto R$ ${discountAmount.toFixed(2)} (${discountReason?.trim()}) - ${forms.map(f => f.method).join(', ')}` 
      : `Recebimento de R$ ${totalPaying.toFixed(2)} - ${forms.map(f => f.method).join(', ')}`;
    await prisma.orderAudit.create({
      data: {
        orderId,
        userId: (session.user as any).id,
        userName: (session.user as any).name || 'Sistema',
        action: 'RECEBIMENTO',
        reason: auditReason,
        previousData: JSON.stringify({
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          status: order.status,
          items: order.items,
        }),
      },
    });

    return NextResponse.json({ payments, totalPaid: totalPaying, discount: discountAmount }, { status: 201 });
  } catch (err: any) {
    console.error('Payment API error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
