/**
 * Controle de estoque (produto acabado) — Fase 1.
 *
 * Toda mudança de saldo passa por aqui e deixa um StockMovement auditável
 * com snapshot do saldo (igual ao padrão do Caixa). As funções recebem um
 * client de transação (tx) para que a baixa seja atômica com o pedido.
 */

type Tx = {
  product: any;
  stockMovement: any;
};

interface MovementInput {
  productId: string;
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'AVARIA';
  quantity: number; // ENTRADA/SAIDA/AVARIA: positivo. AJUSTE: delta com sinal.
  reason: string;
  orderId?: string | null;
  unitCost?: number | null;
  userId?: string | null;
  userName?: string | null;
}

/**
 * Registra um movimento e atualiza o saldo do produto.
 * Retorna o novo saldo. Não valida trackStock — quem chama decide.
 */
export async function recordMovement(tx: Tx, input: MovementInput): Promise<number> {
  const product = await tx.product.findUnique({ where: { id: input.productId } });
  if (!product) return 0;

  const current = product.stockQuantity ?? 0;
  // ENTRADA soma, SAIDA subtrai, AJUSTE aplica o delta (já vem com sinal)
  const delta =
    input.type === 'ENTRADA' ? Math.abs(input.quantity)
    : input.type === 'SAIDA' ? -Math.abs(input.quantity)
    : input.type === 'AVARIA' ? -Math.abs(input.quantity)
    : input.quantity;
  const newBalance = current + delta;

  await tx.product.update({
    where: { id: input.productId },
    data: { stockQuantity: newBalance },
  });

  await tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      orderId: input.orderId ?? null,
      balance: newBalance,
      unitCost: input.unitCost ?? null,
      userId: input.userId ?? null,
      userName: input.userName ?? '',
    },
  });

  return newBalance;
}

/**
 * Dá baixa no estoque para os itens de um pedido.
 * Fase 1b: se o produto de venda tem stockItemId, a baixa vai na chapa base
 * com quantidade * consumptionQty. Saldo pode ir negativo (não bloqueia venda).
 */
export async function applyStockForOrder(
  tx: Tx,
  orderId: string,
  orderNumber: number,
  items: { productId?: string; quantity?: number }[],
  userId?: string | null,
  userName?: string | null,
): Promise<void> {
  for (const it of items ?? []) {
    if (!it.productId) continue;
    const product = await tx.product.findUnique({ where: { id: it.productId } });
    if (!product) continue;

    const qty = it.quantity ?? 1;
    if (qty <= 0) continue;

    // Produto de venda com fator de consumo → baixa na chapa base
    if (product.stockItemId) {
      const base = await tx.product.findUnique({ where: { id: product.stockItemId } });
      if (!base || !base.trackStock) continue;
      await recordMovement(tx, {
        productId: product.stockItemId,
        type: 'SAIDA',
        quantity: qty * (product.consumptionQty ?? 1),
        reason: `Pedido #${orderNumber} (${product.description})`,
        orderId,
        userId,
        userName,
      });
      continue;
    }

    // Produto-base com saldo próprio (comportamento original)
    if (!product.trackStock) continue;
    await recordMovement(tx, {
      productId: it.productId,
      type: 'SAIDA',
      quantity: qty,
      reason: `Pedido #${orderNumber}`,
      orderId,
      userId,
      userName,
    });
  }
}

/**
 * Estorna a baixa de um pedido: devolve ao estoque todas as SAIDAs ainda
 * não estornadas (reversed = false) daquele pedido e as marca como estornadas.
 * Idempotente — chamar duas vezes não duplica o estorno.
 */
export async function reverseStockForOrder(
  tx: Tx,
  orderId: string,
  orderNumber: number,
  userId?: string | null,
  userName?: string | null,
): Promise<void> {
  const exits = await tx.stockMovement.findMany({
    where: { orderId, type: 'SAIDA', reversed: false },
  });

  for (const mv of exits ?? []) {
    await recordMovement(tx, {
      productId: mv.productId,
      type: 'ENTRADA',
      quantity: mv.quantity,
      reason: `Estorno pedido #${orderNumber}`,
      orderId,
      userId,
      userName,
    });
    await tx.stockMovement.update({ where: { id: mv.id }, data: { reversed: true } });
  }
}
