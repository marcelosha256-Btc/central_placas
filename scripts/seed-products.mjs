import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cadastrando produtos com estrutura correta...\n');

  // ── CHAPAS BASE ─────────────────────────────────────────────
  // Recebem entrada via Nota Fiscal. Saldo = chapas físicas.
  const chapaCarro = await prisma.product.create({ data: {
    code: 'CHAPA-CARRO',
    description: 'PLACA PRIMARIA CARRO MERCOSUL',
    category: 'Chapa',
    basePrice: 0,
    trackStock: true,
    minStock: 50,
  }});
  console.log(`✓ [CHAPA BASE] ${chapaCarro.code} — ${chapaCarro.description} (mín. 50)`);

  const chapaMoto = await prisma.product.create({ data: {
    code: 'CHAPA-MOTO',
    description: 'PLACA PRIMARIA MOTO MERCOSUL',
    category: 'Chapa',
    basePrice: 0,
    trackStock: true,
    minStock: 30,
  }});
  console.log(`✓ [CHAPA BASE] ${chapaMoto.code} — ${chapaMoto.description} (mín. 30)`);

  console.log('');

  // ── PRODUTOS DE VENDA — CARRO (consomem CHAPA-CARRO) ────────
  const vendaCarro = [
    { code: 'PAC',   description: 'PAR CARRO MERCOSUL',      basePrice: 340, qty: 2 },
    { code: 'PDC',   description: 'PLACA DIANTEIRA CARRO',   basePrice: 180, qty: 1 },
    { code: 'PTC',   description: 'PLACA TRASEIRA CARRO',    basePrice: 180, qty: 1 },
  ];
  for (const p of vendaCarro) {
    await prisma.product.create({ data: {
      code: p.code, description: p.description, category: 'Placa',
      basePrice: p.basePrice, trackStock: false,
      stockItemId: chapaCarro.id, consumptionQty: p.qty,
    }});
    console.log(`✓ [VENDA ${p.qty}x→CHAPA-CARRO] ${p.code} — ${p.description}`);
  }

  console.log('');

  // ── PRODUTOS DE VENDA — MOTO (consomem CHAPA-MOTO) ──────────
  const vendaMoto = [
    { code: 'MAC',   description: 'MOTO MERCOSUL',           basePrice: 150, qty: 1 },
  ];
  for (const p of vendaMoto) {
    await prisma.product.create({ data: {
      code: p.code, description: p.description, category: 'Placa',
      basePrice: p.basePrice, trackStock: false,
      stockItemId: chapaMoto.id, consumptionQty: p.qty,
    }});
    console.log(`✓ [VENDA ${p.qty}x→CHAPA-MOTO] ${p.code} — ${p.description}`);
  }

  console.log('');

  // ── SEM CONTROLE DE ESTOQUE ──────────────────────────────────
  const outros = [
    { code: 'PAC-ANT', description: 'PLACA ANTIGA CARRO',   category: 'Placa',      basePrice: 160 },
    { code: 'PAM-ANT', description: 'PLACA ANTIGA MOTO',    category: 'Placa',      basePrice: 130 },
    { code: 'LACRE',   description: 'LACRE DE PLACA',       category: 'Acessório',  basePrice: 15  },
    { code: 'SUPORTE', description: 'SUPORTE DE PLACA',     category: 'Acessório',  basePrice: 25  },
    { code: 'TARG',    description: 'TARJETA',               category: 'Serviço',    basePrice: 50  },
    { code: 'INST',    description: 'INSTALAÇÃO',            category: 'Serviço',    basePrice: 30  },
  ];
  for (const p of outros) {
    await prisma.product.create({ data: {
      code: p.code, description: p.description,
      category: p.category, basePrice: p.basePrice,
    }});
    console.log(`✓ [SEM ESTOQUE] ${p.code} — ${p.description}`);
  }

  console.log('\n✅ Pronto! Agora registre as entradas no menu Estoque:');
  console.log('   • CHAPA-CARRO → quantidade conforme NF da BLANKS (ex: 100)');
  console.log('   • CHAPA-MOTO  → quantidade conforme NF da BLANKS (ex: 50)');
  console.log('\n   Venda de 1 PAR CARRO → deduz 2 chapas de CHAPA-CARRO');
  console.log('   Venda de 1 MOTO      → deduz 1 chapa  de CHAPA-MOTO');
}

main()
  .catch(e => { console.error('Erro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
