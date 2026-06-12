export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Bulk payment: receives multiple orderIds and paymentForms,
 * distributes payment across orders (oldest first) until the total is exhausted.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { orderIds, paymentForms, discount: rawDiscount, discountReason } = await req.json();
    const discountAmount = parseFloat(String(rawDiscount)) || 0;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Informe os pedidos' }, { status: 400 });
    }

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

    if (!paymentForms || !Array.isArray(paymentForms) || paymentForms.length === 0) {
      if (discountAmount <= 0) {
        return NextResponse.json({ error: 'Informe as formas de pagamento' }, { status: 400 });
      }
    }

    const forms = (paymentForms || [])
      .map((f: any) => ({ method: f.method || 'PIX', value: parseFloat(String(f.value)) || 0 }))
      .filter((f: any) => f.value > 0);

    const totalPaying = forms.reduce((sum: number, f: any) => sum + f.value, 0);
    if (totalPaying <= 0 && discountAmount <= 0) return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });

    // Verificar se há caixa aberto (só se há dinheiro real)
    let openCash: any = null;
    if (totalPaying > 0) {
      openCash = await prisma.cashRegister.findFirst({
        where: { status: { in: ['ABERTO', 'EM_CONFERENCIA'] } },
      });
      if (!openCash) {
        return NextResponse.json({ error: 'Caixa fechado. Abra o caixa antes de registrar recebimentos.' }, { status: 400 });
      }
    }

    // Fetch all orders ordered by orderNumber (oldest first)
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'ABERTO', deleted: false },
      include: { customer: { select: { name: true } } },
      orderBy: { orderNumber: 'asc' },
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Nenhum pedido em aberto encontrado' }, { status: 404 });
    }

    const totalRemaining = orders.reduce((sum: number, o: any) => sum + ((o.totalAmount ?? 0) - (o.paidAmount ?? 0)), 0);
    if ((totalPaying + discountAmount) - totalRemaining > 0.01) {
      return NextResponse.json({ error: 'Valor recebido + desconto maior que o saldo devedor total' }, { status: 400 });
    }

    // Distribute payment + discount across orders (oldest first)
    const totalToSettle = totalPaying + discountAmount;
    let cashRemaining = totalPaying;
    let discountRemaining = discountAmount;
    const allPayments: any[] = [];

    for (const order of orders) {
      if (cashRemaining <= 0.001 && discountRemaining <= 0.001) break;
      const orderRemaining = (order.totalAmount ?? 0) - (order.paidAmount ?? 0);
      if (orderRemaining <= 0) continue;

      const settleForOrder = Math.min(cashRemaining + discountRemaining, orderRemaining);
      // Proportion: cash first, discount fills the rest
      const cashForOrder = Math.min(cashRemaining, settleForOrder);
      const discountForOrder = settleForOrder - cashForOrder;
      cashRemaining -= cashForOrder;
      discountRemaining -= discountForOrder;

      // Distribute cash proportionally across payment methods
      if (cashForOrder > 0.001 && forms.length > 0) {
        let leftForOrder = cashForOrder;
        for (let fi = 0; fi < forms.length && leftForOrder > 0.001; fi++) {
          const proportion = forms[fi].value / totalPaying;
          let amount = fi === forms.length - 1 ? leftForOrder : Math.min(Math.round(cashForOrder * proportion * 100) / 100, leftForOrder);
          if (amount <= 0) continue;
          leftForOrder -= amount;

          const payment = await prisma.payment.create({
            data: {
              orderId: order.id,
              amount,
              paymentMethod: forms[fi].method,
              notes: `Recebimento em lote`,
            },
          });
          allPayments.push(payment);

          // Cash movement
          if (openCash) {
            await prisma.cashMovement.create({
              data: {
                cashRegisterId: openCash.id,
                type: 'ENTRADA',
                amount,
                description: `Pedido #${order.orderNumber} - ${(order as any).customer?.name || 'Cliente'}`,
                paymentMethod: forms[fi].method,
                orderId: order.id,
              },
            });
          }
        }
      }

      // Registrar desconto para este pedido
      if (discountForOrder > 0.001) {
        await prisma.invoiceDiscount.create({
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: (session.user as any).id,
            userName: (session.user as any).name || 'Sistema',
            customerId: order.customerId,
            customerName: (order as any).customer?.name || '',
            amount: discountForOrder,
            reason: discountReason?.trim() || '',
          },
        });
      }

      // Update order
      const newPaid = (order.paidAmount ?? 0) + settleForOrder;
      const updateData: any = { paidAmount: newPaid };
      if (newPaid >= (order.totalAmount ?? 0) - 0.01) {
        updateData.status = 'PAGO';
      }
      await prisma.order.update({ where: { id: order.id }, data: updateData });
    }

    return NextResponse.json({ payments: allPayments, totalPaid: totalPaying, discount: discountAmount, ordersProcessed: orders.length }, { status: 201 });
  } catch (err: any) {
    console.error('Bulk payment API error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
