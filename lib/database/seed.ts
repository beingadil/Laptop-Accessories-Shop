import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

const globalForSeed = globalThis as unknown as {
  __tayyabSeedPromise?: Promise<void>;
};

export async function ensureDatabaseSeeded(): Promise<void> {
  if (!globalForSeed.__tayyabSeedPromise) {
    globalForSeed.__tayyabSeedPromise = runIdempotentBootstrap().catch((err) => {
      globalForSeed.__tayyabSeedPromise = undefined;
      throw err;
    });
  }
  return globalForSeed.__tayyabSeedPromise;
}

export function resetSeedCache() {
  globalForSeed.__tayyabSeedPromise = undefined;
}

async function runIdempotentBootstrap(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = -16000;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  } catch {
    // Ignore if unsupported
  }

  // Admin: create only on a brand-new install. Credentials are the documented
  // default (admin / admin123) and should be changed via Settings → Admin Security.
  const adminCount = await prisma.adminUser.count();
  if (adminCount === 0) {
    const passwordHash = await hashPassword('admin123');
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        displayName: 'Tayyab Admin',
        passwordHash,
      },
    });
  }

  // Shop profile
  const settings = await prisma.shopSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    await prisma.shopSettings.create({
      data: {
        id: 'default',
        shopName: 'Tayyab Enterprises',
        address: 'Muneer Chowk, Shop No. 152',
        phone1: '03126482836',
        phone2: '03298304862',
        invoicePrefix: 'TE-INV-',
        purchasePrefix: 'TE-PUR-',
      },
    });
  }

  // Product categories (reference data)
  const productCategoryCount = await prisma.productCategory.count();
  if (productCategoryCount === 0) {
    await prisma.productCategory.createMany({
      data: [
        { name: 'Laptops', description: 'Business, ultrabook, and workstation laptops', defaultInventoryType: 'SERIALIZED' },
        { name: 'Chromebooks', description: 'Education and lightweight ChromeOS laptops', defaultInventoryType: 'SERIALIZED' },
        { name: 'Laptop Chargers', description: 'Original and OEM laptop power adapters', defaultInventoryType: 'QUANTITY' },
        { name: 'Laptop Accessories', description: 'Bags, mice, docking stations, cooling pads', defaultInventoryType: 'QUANTITY' },
        { name: 'Laptop Batteries', description: 'Replacement internal and external batteries', defaultInventoryType: 'QUANTITY' },
        { name: 'RAM', description: 'DDR3, DDR4, and DDR5 laptop memory modules', defaultInventoryType: 'QUANTITY' },
        { name: 'SSD', description: 'NVMe M.2 and 2.5-inch SATA solid state drives', defaultInventoryType: 'QUANTITY' },
        { name: 'HDD', description: '2.5-inch internal and external hard drives', defaultInventoryType: 'QUANTITY' },
      ],
    });
  }

  // Expense categories (reference data)
  const expenseCategoryCount = await prisma.expenseCategory.count();
  if (expenseCategoryCount === 0) {
    await prisma.expenseCategory.createMany({
      data: [
        { name: 'Rent' },
        { name: 'Electricity' },
        { name: 'Internet' },
        { name: 'Salary' },
        { name: 'Transport' },
        { name: 'Repair' },
        { name: 'Miscellaneous' },
      ],
    });
  }
}
