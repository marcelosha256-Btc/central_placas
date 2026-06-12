// ============================================
// invoice-calc — Funções compartilhadas de fatura
// Os PEDIDOS são a fonte da verdade do que está em aberto.
// ============================================
import { prisma } from '@/lib/prisma';

// Saldo em aberto de TODOS os pedidos cobrados por uma fatura
// (os do mês + o saldo anterior carregado), até o fim do período.
// Retorna também quanto já foi recebido em relação ao amountDue (snapshot).
export async function computeInvoiceReceived(invoice: {
  customerId: string;
  periodEnd: Date;
  amountDue?: number | null;
}) {
  const billedOrders = await prisma.order.findMany({
    where: {
      customerId: invoice.customerId,
      deleted: false,
      createdAt: { lte: invoice.periodEnd },
    },
    select: { totalAmount: true, paidAmount: true },
  });
  const openBalance = billedOrders.reduce(
    (sum: number, o: any) => sum + Math.max(0, (o.totalAmount ?? 0) - (o.paidAmount ?? 0)),
    0
  );
  const amountDue = invoice.amountDue ?? 0;
  const amountReceived = Math.max(0, Math.min(amountDue, amountDue - openBalance));
  return { amountReceived, openBalance };
}
