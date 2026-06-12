import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const adminPass = await bcrypt.hash('admin123', 10);
  const testPass = await bcrypt.hash('johndoe123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@centralplacas.com.br' },
    update: {},
    create: { email: 'admin@centralplacas.com.br', password: adminPass, name: 'Administrador', role: 'admin', active: true },
  });

  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: { email: 'john@doe.com', password: testPass, name: 'Admin Sistema', role: 'admin', active: true },
  });

  console.log('Users seeded');

  // Products
  const productsData = [
    { code: 'PMC', description: 'Placa Mercosul Carro', category: 'Placa', basePrice: 180.00 },
    { code: 'PMM', description: 'Placa Mercosul Moto', category: 'Placa', basePrice: 150.00 },
    { code: 'PAC', description: 'Placa Antiga Carro', category: 'Placa', basePrice: 160.00 },
    { code: 'PAM', description: 'Placa Antiga Moto', category: 'Placa', basePrice: 130.00 },
    { code: 'PMC-PAR', description: 'Par Placas Mercosul Carro', category: 'Placa', basePrice: 340.00 },
    { code: 'PMM-PAR', description: 'Par Placas Mercosul Moto', category: 'Placa', basePrice: 280.00 },
    { code: 'TARG', description: 'Tarjeta', category: 'Serviço', basePrice: 50.00 },
    { code: 'LACRE', description: 'Lacre de Placa', category: 'Acessório', basePrice: 15.00 },
    { code: 'SUPORTE', description: 'Suporte de Placa', category: 'Acessório', basePrice: 25.00 },
    { code: 'INST', description: 'Instalação', category: 'Serviço', basePrice: 30.00 },
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    products.push(prod);
  }
  console.log('Products seeded');

  // Price Tables
  const varejo = await prisma.priceTable.upsert({
    where: { name: 'Varejo' },
    update: {},
    create: { name: 'Varejo' },
  });

  const atacado = await prisma.priceTable.upsert({
    where: { name: 'Atacado' },
    update: {},
    create: { name: 'Atacado' },
  });

  // Set prices for Varejo
  for (const p of products) {
    await prisma.priceTableItem.upsert({
      where: { priceTableId_productId: { priceTableId: varejo.id, productId: p.id } },
      update: {},
      create: { priceTableId: varejo.id, productId: p.id, price: p.basePrice },
    });
    await prisma.priceTableItem.upsert({
      where: { priceTableId_productId: { priceTableId: atacado.id, productId: p.id } },
      update: {},
      create: { priceTableId: atacado.id, productId: p.id, price: Math.round(p.basePrice * 0.85 * 100) / 100 },
    });
  }
  console.log('Price tables seeded');

  // Customers
  const customersData = [
    { name: 'João Silva', personType: 'PF', document: '52998224725', phone: '11999998888', whatsapp: '11999998888', email: 'joao@email.com', cep: '01001000', street: 'Praça da Sé', number: '100', neighborhood: 'Sé', city: 'São Paulo', state: 'SP', priceTableId: varejo.id },
    { name: 'Auto Center Brasil LTDA', personType: 'PJ', document: '11222333000181', phone: '11988887777', whatsapp: '11988887777', email: 'contato@autocenter.com.br', cep: '04538133', street: 'Av. Brigadeiro Faria Lima', number: '1500', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', priceTableId: atacado.id },
    { name: 'Maria Oliveira', personType: 'PF', document: '71143380401', phone: '21977776666', whatsapp: '21977776666', email: 'maria@email.com', cep: '20040020', street: 'Rua do Ouvidor', number: '50', neighborhood: 'Centro', city: 'Rio de Janeiro', state: 'RJ', priceTableId: varejo.id },
    { name: 'Despachante Rápido', personType: 'PJ', document: '33444555000199', phone: '31966665555', whatsapp: '31966665555', email: 'desp@rapido.com', cep: '30130001', street: 'Av. Afonso Pena', number: '2000', neighborhood: 'Centro', city: 'Belo Horizonte', state: 'MG', priceTableId: atacado.id },
    { name: 'Carlos Santos', personType: 'PF', document: '48765371802', phone: '41955554444', whatsapp: '41955554444', email: 'carlos@email.com', cep: '80010100', street: 'Rua XV de Novembro', number: '300', neighborhood: 'Centro', city: 'Curitiba', state: 'PR', priceTableId: varejo.id },
  ];

  const customers: any[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { document: c.document },
      update: {},
      create: c,
    });
    customers.push(cust);
  }
  console.log('Customers seeded');

  // Orders
  const ordersData = [
    {
      customerId: customers[0].id,
      userId: admin.id,
      plateNumber: 'ABC1D23',
      plateType: 'Mercosul',
      vehicleModel: 'Honda Civic 2024',
      status: 'PAGO',
      paymentMethod: 'PIX',
      totalAmount: 180.00,
      paidAmount: 180.00,
      items: [{ productId: products[0].id, description: 'Placa Mercosul Carro', unitPrice: 180.00, totalPrice: 180.00 }],
    },
    {
      customerId: customers[1].id,
      userId: admin.id,
      plateNumber: 'XYZ4567',
      plateType: 'Antiga',
      vehicleModel: 'Toyota Corolla 2023',
      status: 'ABERTO',
      paymentMethod: 'A_PRAZO',
      totalAmount: 370.00,
      paidAmount: 0,
      items: [
        { productId: products[0].id, description: 'Placa Mercosul Carro', unitPrice: 180.00, totalPrice: 180.00 },
        { productId: products[0].id, description: 'Placa Mercosul Carro', unitPrice: 180.00, totalPrice: 180.00, plateNumber: 'DEF5G67' },
        { productId: products[9].id, description: 'Instalação', unitPrice: 10.00, totalPrice: 10.00 },
      ],
    },
    {
      customerId: customers[2].id,
      userId: admin.id,
      plateNumber: 'MNO8P90',
      plateType: 'Mercosul',
      vehicleModel: 'VW Gol 2022',
      status: 'PAGO',
      paymentMethod: 'DINHEIRO',
      totalAmount: 150.00,
      paidAmount: 150.00,
      items: [{ productId: products[1].id, description: 'Placa Mercosul Moto', unitPrice: 150.00, totalPrice: 150.00 }],
    },
  ];

  for (const o of ordersData) {
    const { items, ...orderData } = o;
    const existingOrder = await prisma.order.findFirst({
      where: { customerId: orderData.customerId, plateNumber: orderData.plateNumber },
    });
    if (!existingOrder) {
      await prisma.order.create({
        data: {
          ...orderData,
          items: {
            create: items.map((i: any) => ({
              productId: i.productId,
              description: i.description,
              plateNumber: i.plateNumber ?? '',
              quantity: 1,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
          },
        },
      });
    }
  }
  console.log('Orders seeded');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
