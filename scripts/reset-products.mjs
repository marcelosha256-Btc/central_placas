// Reset completo: limpa estoque, pedidos e produtos para recadastro correto
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando reset de produtos...\n');

  const sm = await prisma.stockMovement.deleteMany({});
  console.log(`✓ StockMovements deletados: ${sm.count}`);

  const oi = await prisma.orderItem.deleteMany({});
  console.log(`✓ OrderItems deletados: ${oi.count}`);

  const oa = await prisma.orderAudit.deleteMany({});
  console.log(`✓ OrderAudits deletados: ${oa.count}`);

  const pay = await prisma.payment.deleteMany({});
  console.log(`✓ Payments deletados: ${pay.count}`);

  const disc = await prisma.invoiceDiscount.deleteMany({});
  console.log(`✓ InvoiceDiscounts deletados: ${disc.count}`);

  const ord = await prisma.order.deleteMany({});
  console.log(`✓ Orders deletados: ${ord.count}`);

  const pti = await prisma.priceTableItem.deleteMany({});
  console.log(`✓ PriceTableItems deletados: ${pti.count}`);

  const prod = await prisma.product.deleteMany({});
  console.log(`✓ Produtos deletados: ${prod.count}`);

  console.log('\n✅ Reset concluído! Recadastre os produtos na tela de Produtos.');
}

main()
  .catch(e => { console.error('Erro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
