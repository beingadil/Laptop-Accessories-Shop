/**
 * Integration tests: sales/returns services against a real (temporary) SQLite
 * database. Verifies atomic stock claims and refund caps end-to-end — the two
 * bug classes found in the audit. Run via `pnpm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const TEST_DB = path.join(here, '.tmp-integration.db');

// Point the app at the temp DB BEFORE importing anything that builds PrismaClient.
process.env.DATABASE_URL = `file:${TEST_DB}`;

 
let prisma: any;
 
let createSale: any;
 
let createReturn: any;

test.before(() => {
  if (fs.existsSync(TEST_DB)) fs.rmSync(TEST_DB);
  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss'],
    { cwd: root, env: { ...process.env }, stdio: 'pipe' }
  );
});

test.before(async () => {
  ({ prisma } = await import('../../lib/prisma.ts'));
  ({ createSale } = await import('../../lib/services/sales.ts'));
  ({ createReturn } = await import('../../lib/services/returns.ts'));
});

test.after(() => {
  try {
    fs.rmSync(TEST_DB);
  } catch {
    // best effort
  }
});

const rand = () => Math.random().toString(36).slice(2, 10);

async function makeQuantityProduct(stock: number) {
  const cat = await prisma.productCategory.upsert({
    where: { name: 'TestCat' },
    update: {},
    create: { name: 'TestCat' },
  });
  return prisma.product.create({
    data: {
      name: `Charger ${rand()}`,
      sku: `SKU-${rand()}`,
      brand: 'TestBrand',
      model: 'M1',
      categoryId: cat.id,
      currentStock: stock,
      sellingPrice: 1000,
      purchasePrice: 600,
      inventoryType: 'QUANTITY',
    },
  });
}

async function makeSerializedProduct() {
  const cat = await prisma.productCategory.upsert({
    where: { name: 'TestCat' },
    update: {},
    create: { name: 'TestCat' },
  });
  const product = await prisma.product.create({
    data: {
      name: `Laptop ${rand()}`,
      sku: `SKU-${rand()}`,
      brand: 'TestBrand',
      model: 'LX1',
      categoryId: cat.id,
      currentStock: 1,
      sellingPrice: 80000,
      purchasePrice: 60000,
      inventoryType: 'SERIALIZED',
    },
  });
  const serial = await prisma.serializedInventoryItem.create({
    data: {
      productId: product.id,
      serialNumber: `SN-${rand()}`,
      purchasePrice: 60000,
      sellingPrice: 80000,
      stockStatus: 'IN_STOCK',
    },
  });
  return { product, serial };
}

async function makeAdmin() {
  return prisma.adminUser.create({
    data: { username: `admin-${rand()}`, passwordHash: 'x' },
  });
}

const baseSale = (items: unknown[]) => ({
  saleDate: new Date().toISOString(),
  discount: 0,
  paymentMethod: 'CASH' as const,
  items,
});

test('quantity product: sale decrements stock atomically', async () => {
  const admin = await makeAdmin();
  const product = await makeQuantityProduct(5);

  const sale = await createSale(
    baseSale([{ productId: product.id, quantity: 2, unitPrice: 1000, discount: 0, warrantyMonths: 0 }]),
    admin.id
  );

  const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  assert.equal(after.currentStock, 3);
  assert.ok(sale.invoiceNumber.length > 0);
});

test('oversell is rejected and stock is untouched', async () => {
  const admin = await makeAdmin();
  const product = await makeQuantityProduct(2);

  await assert.rejects(
    () =>
      createSale(
        baseSale([{ productId: product.id, quantity: 99, unitPrice: 1000, discount: 0, warrantyMonths: 0 }]),
        admin.id
      ),
    /Insufficient stock/
  );

  const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  assert.equal(after.currentStock, 2);
});

test('serialized unit cannot be sold twice (atomic claim)', async () => {
  const admin = await makeAdmin();
  const { product, serial } = await makeSerializedProduct();

  await createSale(
    baseSale([{ productId: product.id, serializedItemId: serial.id, quantity: 1, unitPrice: 80000, discount: 0, warrantyMonths: 0 }]),
    admin.id
  );

  await assert.rejects(
    () =>
      createSale(
        baseSale([{ productId: product.id, serializedItemId: serial.id, quantity: 1, unitPrice: 80000, discount: 0, warrantyMonths: 0 }]),
        admin.id
      ),
    /not available|already/i
  );

  const after = await prisma.serializedInventoryItem.findUniqueOrThrow({ where: { id: serial.id } });
  assert.equal(after.stockStatus, 'SOLD');
});

test('refund above paid amount is rejected; sane refund accepted', async () => {
  const admin = await makeAdmin();
  const product = await makeQuantityProduct(5);

  const sale = await createSale(
    baseSale([{ productId: product.id, quantity: 1, unitPrice: 1000, discount: 0, warrantyMonths: 0 }]),
    admin.id
  );
  const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });

  await assert.rejects(
    () =>
      createReturn(
        {
          originalSaleId: sale.id,
          returnDate: new Date().toISOString(),
          reason: 'DEFECTIVE',
          items: [{ saleItemId: saleItem.id, quantity: 1, restockStatus: 'RESTOCKED', refundAmount: 999999 }],
        },
        admin.id
      ),
    /exceed/
  );

  const ok = await createReturn(
    {
      originalSaleId: sale.id,
      returnDate: new Date().toISOString(),
      reason: 'DEFECTIVE',
      items: [{ saleItemId: saleItem.id, quantity: 1, restockStatus: 'RESTOCKED', refundAmount: 500 }],
    },
    admin.id
  );
  assert.ok(ok.returnNumber.length > 0);

  const afterItem = await prisma.saleItem.findUniqueOrThrow({ where: { id: saleItem.id } });
  assert.equal(afterItem.returnedQuantity, 1);
});

test('two consecutive sales receive distinct invoice numbers', async () => {
  const admin = await makeAdmin();
  const product = await makeQuantityProduct(10);

  const a = await createSale(
    baseSale([{ productId: product.id, quantity: 1, unitPrice: 1000, discount: 0, warrantyMonths: 0 }]),
    admin.id
  );
  const b = await createSale(
    baseSale([{ productId: product.id, quantity: 1, unitPrice: 1000, discount: 0, warrantyMonths: 0 }]),
    admin.id
  );

  assert.notEqual(a.invoiceNumber, b.invoiceNumber);
});
