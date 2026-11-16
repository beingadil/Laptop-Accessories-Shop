import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { calculateWarrantyEndDate } from '@/lib/domain/calculations';

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

function daysAgo(days: number, hour = 13, minute = 15): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute, 0, 0);
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

  const [existingProducts, existingSuppliers, existingSales] = await Promise.all([
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.sale.count(),
  ]);

  if (existingProducts === 0 && existingSuppliers === 0 && existingSales === 0) {
    await seedInitialDemoData();
  }
}

async function seedInitialDemoData() {
  const categories = await prisma.productCategory.findMany();
  const expenseCategories = await prisma.expenseCategory.findMany();
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const expCatByName = new Map(expenseCategories.map((c) => [c.name, c.id]));

  const laptopsCat = catByName.get('Laptops');
  const chromebooksCat = catByName.get('Chromebooks');
  const chargersCat = catByName.get('Laptop Chargers');
  const ramCat = catByName.get('RAM');
  const ssdCat = catByName.get('SSD');
  const accessoriesCat = catByName.get('Laptop Accessories');

  if (!laptopsCat || !chromebooksCat || !chargersCat || !ramCat || !ssdCat || !accessoriesCat) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const sup1 = await tx.supplier.create({
      data: {
        name: 'Al-Rehman IT Imports',
        phone: '03004412890',
        address: 'Hall Road, Lahore',
        openingBalance: 45000,
        outstandingBalance: 165000,
        notes: 'Primary imported business laptops supplier',
      },
    });
    const sup2 = await tx.supplier.create({
      data: {
        name: 'TechLink Wholesale Accessories',
        phone: '03217784512',
        address: 'Hafeez Center, Lahore',
        openingBalance: 0,
        outstandingBalance: 24000,
        notes: 'Chargers, NVMe SSDs, and RAM modules',
      },
    });

    const cust1 = await tx.customer.create({
      data: {
        name: 'Usman Tariq',
        phone: '03336541209',
        address: 'Model Town, Block C',
        notes: 'Corporate buyer — prefers Dell Latitude series',
      },
    });
    const cust2 = await tx.customer.create({
      data: {
        name: 'Ayesha Siddiqui',
        phone: '03158890431',
        address: 'Johar Town, Phase 2',
      },
    });
    const cust3 = await tx.customer.create({
      data: {
        name: 'Bilal Electronics & Tuition',
        phone: '03457120984',
        address: 'Gulberg III',
      },
    });

    const pDell5420 = await tx.product.create({
      data: {
        name: 'Dell Latitude 5420 Core i5 11th Gen',
        sku: 'TE-LAP-5420',
        categoryId: laptopsCat,
        brand: 'Dell',
        model: 'Latitude 5420',
        processor: 'Core i5-1145G7',
        ram: '16GB DDR4',
        ssd: '256GB NVMe',
        screenSize: '14" FHD IPS',
        condition: 'USED',
        purchasePrice: 72000,
        sellingPrice: 86000,
        minimumStock: 2,
        currentStock: 3,
        inventoryType: 'SERIALIZED',
      },
    });

    const pHp840G7 = await tx.product.create({
      data: {
        name: 'HP EliteBook 840 G7 Core i5 10th Gen',
        sku: 'TE-LAP-840G7',
        categoryId: laptopsCat,
        brand: 'HP',
        model: 'EliteBook 840 G7',
        processor: 'Core i5-10310U',
        ram: '16GB DDR4',
        ssd: '512GB NVMe',
        screenSize: '14" FHD',
        condition: 'USED',
        purchasePrice: 68000,
        sellingPrice: 82000,
        minimumStock: 2,
        currentStock: 1,
        inventoryType: 'SERIALIZED',
      },
    });

    const pThinkpadT14 = await tx.product.create({
      data: {
        name: 'Lenovo ThinkPad T14 Gen 2 Ryzen 5',
        sku: 'TE-LAP-T14G2',
        categoryId: laptopsCat,
        brand: 'Lenovo',
        model: 'ThinkPad T14 Gen 2',
        processor: 'Ryzen 5 Pro 5650U',
        ram: '16GB DDR4',
        ssd: '512GB NVMe',
        screenSize: '14" FHD Touch',
        condition: 'REFURBISHED',
        purchasePrice: 76000,
        sellingPrice: 92000,
        minimumStock: 2,
        currentStock: 1,
        inventoryType: 'SERIALIZED',
      },
    });

    const pChromebook = await tx.product.create({
      data: {
        name: 'Dell Chromebook 3100 11.6" Touch',
        sku: 'TE-CB-3100',
        categoryId: chromebooksCat,
        brand: 'Dell',
        model: 'Chromebook 3100',
        processor: 'Intel Celeron N4020',
        ram: '4GB LPDDR4',
        ssd: '32GB eMMC',
        screenSize: '11.6" HD',
        condition: 'USED',
        purchasePrice: 13500,
        sellingPrice: 18500,
        minimumStock: 3,
        currentStock: 3,
        inventoryType: 'SERIALIZED',
      },
    });

    const pCharger65W = await tx.product.create({
      data: {
        name: 'Original 65W USB-C Laptop Charger',
        sku: 'TE-ACC-65W',
        categoryId: chargersCat,
        brand: 'Dell / HP',
        model: '65W Type-C OEM',
        condition: 'NEW',
        purchasePrice: 2100,
        sellingPrice: 3200,
        minimumStock: 5,
        currentStock: 12,
        inventoryType: 'QUANTITY',
      },
    });

    const pNvme512 = await tx.product.create({
      data: {
        name: 'Samsung PM991 512GB NVMe M.2 SSD',
        sku: 'TE-SSD-512',
        categoryId: ssdCat,
        brand: 'Samsung',
        model: 'PM991 512GB',
        ssd: '512GB NVMe',
        condition: 'NEW',
        purchasePrice: 6800,
        sellingPrice: 9200,
        minimumStock: 4,
        currentStock: 3,
        inventoryType: 'QUANTITY',
      },
    });

    const pRam16 = await tx.product.create({
      data: {
        name: 'Crucial 16GB DDR4 3200MHz Laptop RAM',
        sku: 'TE-RAM-16D4',
        categoryId: ramCat,
        brand: 'Crucial',
        model: 'DDR4-3200 SO-DIMM',
        ram: '16GB DDR4',
        condition: 'NEW',
        purchasePrice: 6200,
        sellingPrice: 8500,
        minimumStock: 4,
        currentStock: 7,
        inventoryType: 'QUANTITY',
      },
    });

    const pBag = await tx.product.create({
      data: {
        name: 'Executive 15.6" Padded Laptop Backpack',
        sku: 'TE-ACC-BAG15',
        categoryId: accessoriesCat,
        brand: 'Targus',
        model: 'Classic 15.6',
        condition: 'NEW',
        purchasePrice: 1900,
        sellingPrice: 3000,
        minimumStock: 5,
        currentStock: 0,
        inventoryType: 'QUANTITY',
      },
    });

    const pur1 = await tx.purchase.create({
      data: {
        purchaseNumber: 'TE-PUR-1001',
        supplierId: sup1.id,
        purchaseDate: daysAgo(9, 11, 30),
        totalAmount: 556000,
        paidAmount: 400000,
        outstandingAmount: 156000,
        notes: 'Imported laptop lot #42 (Latitude, EliteBook, ThinkPad, Chromebooks)',
        status: 'COMPLETED',
      },
    });

    await tx.purchaseItem.createMany({
      data: [
        {
          purchaseId: pur1.id,
          productId: pDell5420.id,
          quantity: 4,
          unitCost: 72000,
          totalCost: 288000,
          condition: 'USED',
          serialNumbers: 'DL5420-8841, DL5420-8842, DL5420-8843, DL5420-8844',
        },
        {
          purchaseId: pur1.id,
          productId: pHp840G7.id,
          quantity: 2,
          unitCost: 68000,
          totalCost: 136000,
          condition: 'USED',
          serialNumbers: 'HP840G7-3311, HP840G7-3312',
        },
        {
          purchaseId: pur1.id,
          productId: pThinkpadT14.id,
          quantity: 1,
          unitCost: 76000,
          totalCost: 76000,
          condition: 'REFURBISHED',
          serialNumbers: 'LNT14-9012',
        },
        {
          purchaseId: pur1.id,
          productId: pChromebook.id,
          quantity: 4,
          unitCost: 14000,
          totalCost: 56000,
          condition: 'USED',
          serialNumbers: 'CB3100-101, CB3100-102, CB3100-103, CB3100-104',
        },
      ],
    });

    const pur2 = await tx.purchase.create({
      data: {
        purchaseNumber: 'TE-PUR-1002',
        supplierId: sup2.id,
        purchaseDate: daysAgo(6, 14, 0),
        totalAmount: 109000,
        paidAmount: 85000,
        outstandingAmount: 24000,
        notes: 'Chargers, NVMe drives, and DDR4 memory',
        status: 'COMPLETED',
      },
    });

    await tx.purchaseItem.createMany({
      data: [
        {
          purchaseId: pur2.id,
          productId: pCharger65W.id,
          quantity: 15,
          unitCost: 2100,
          totalCost: 31500,
          condition: 'NEW',
        },
        {
          purchaseId: pur2.id,
          productId: pNvme512.id,
          quantity: 4,
          unitCost: 6800,
          totalCost: 27200,
          condition: 'NEW',
        },
        {
          purchaseId: pur2.id,
          productId: pRam16.id,
          quantity: 8,
          unitCost: 6287.5,
          totalCost: 50300,
          condition: 'NEW',
        },
      ],
    });

    await tx.supplierPayment.create({
      data: {
        supplierId: sup1.id,
        paymentDate: daysAgo(5, 16, 0),
        amount: 36000,
        paymentMethod: 'CASH',
        referenceNumber: 'PAY-ALR-09',
        notes: 'Partial settlement against opening & lot #42 balance',
      },
    });

    // Serialized items
    const snDellSold = await tx.serializedInventoryItem.create({
      data: {
        productId: pDell5420.id,
        serialNumber: 'DL5420-8841',
        purchasePrice: 72000,
        sellingPrice: 86000,
        condition: 'USED',
        purchaseId: pur1.id,
        stockStatus: 'SOLD',
      },
    });
    const snHpSold = await tx.serializedInventoryItem.create({
      data: {
        productId: pHp840G7.id,
        serialNumber: 'HP840G7-3311',
        purchasePrice: 68000,
        sellingPrice: 82000,
        condition: 'USED',
        purchaseId: pur1.id,
        stockStatus: 'SOLD',
      },
    });
    await tx.serializedInventoryItem.createMany({
      data: [
        {
          productId: pDell5420.id,
          serialNumber: 'DL5420-8842',
          purchasePrice: 72000,
          sellingPrice: 86000,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pDell5420.id,
          serialNumber: 'DL5420-8843',
          purchasePrice: 72000,
          sellingPrice: 86000,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pDell5420.id,
          serialNumber: 'DL5420-8844',
          purchasePrice: 72000,
          sellingPrice: 86000,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pHp840G7.id,
          serialNumber: 'HP840G7-3312',
          purchasePrice: 68000,
          sellingPrice: 82000,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pThinkpadT14.id,
          serialNumber: 'LNT14-9012',
          purchasePrice: 76000,
          sellingPrice: 92000,
          condition: 'REFURBISHED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
      ],
    });

    const snCbSold = await tx.serializedInventoryItem.create({
      data: {
        productId: pChromebook.id,
        serialNumber: 'CB3100-101',
        purchasePrice: 13500,
        sellingPrice: 18500,
        condition: 'USED',
        purchaseId: pur1.id,
        stockStatus: 'SOLD',
      },
    });
    await tx.serializedInventoryItem.createMany({
      data: [
        {
          productId: pChromebook.id,
          serialNumber: 'CB3100-102',
          purchasePrice: 13500,
          sellingPrice: 18500,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pChromebook.id,
          serialNumber: 'CB3100-103',
          purchasePrice: 13500,
          sellingPrice: 18500,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
        {
          productId: pChromebook.id,
          serialNumber: 'CB3100-104',
          purchasePrice: 13500,
          sellingPrice: 18500,
          condition: 'USED',
          purchaseId: pur1.id,
          stockStatus: 'IN_STOCK',
        },
      ],
    });

    // Sales across recent days + today
    const sale0Date = daysAgo(6, 16, 10);
    const sale0 = await tx.sale.create({
      data: {
        invoiceNumber: 'TE-INV-1000',
        customerId: cust2.id,
        saleDate: sale0Date,
        subtotal: 90500,
        discount: 500,
        totalAmount: 90000,
        totalCost: 74200,
        grossProfit: 15800,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        notes: 'HP EliteBook 840 G7 + 16GB RAM upgrade',
      },
    });
    const si0 = await tx.saleItem.create({
      data: {
        saleId: sale0.id,
        productId: pHp840G7.id,
        serializedItemId: snHpSold.id,
        quantity: 1,
        unitPrice: 82000,
        unitCost: 68000,
        discount: 0,
        totalAmount: 82000,
        warrantyMonths: 3,
      },
    });
    await tx.saleItem.create({
      data: {
        saleId: sale0.id,
        productId: pRam16.id,
        quantity: 1,
        unitPrice: 8500,
        unitCost: 6200,
        discount: 0,
        totalAmount: 8500,
        warrantyMonths: 6,
      },
    });
    await tx.warranty.create({
      data: {
        saleId: sale0.id,
        saleItemId: si0.id,
        customerId: cust2.id,
        productId: pHp840G7.id,
        serializedItemId: snHpSold.id,
        warrantyStart: sale0Date,
        warrantyEnd: calculateWarrantyEndDate(sale0Date, 3),
        durationMonths: 3,
        warrantyTerms: '3 months hardware checking warranty.',
        status: 'ACTIVE',
      },
    });

    const sale1Date = daysAgo(4, 15, 20);
    const sale1 = await tx.sale.create({
      data: {
        invoiceNumber: 'TE-INV-1001',
        customerId: cust1.id,
        saleDate: sale1Date,
        subtotal: 89200,
        discount: 1200,
        totalAmount: 88000,
        totalCost: 74100,
        grossProfit: 13900,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        notes: 'Dell Latitude 5420 + 65W OEM Type-C Adapter',
      },
    });
    const si1 = await tx.saleItem.create({
      data: {
        saleId: sale1.id,
        productId: pDell5420.id,
        serializedItemId: snDellSold.id,
        quantity: 1,
        unitPrice: 86000,
        unitCost: 72000,
        discount: 0,
        totalAmount: 86000,
        warrantyMonths: 3,
      },
    });
    await tx.saleItem.create({
      data: {
        saleId: sale1.id,
        productId: pCharger65W.id,
        quantity: 1,
        unitPrice: 3200,
        unitCost: 2100,
        discount: 0,
        totalAmount: 3200,
        warrantyMonths: 1,
      },
    });
    await tx.warranty.create({
      data: {
        saleId: sale1.id,
        saleItemId: si1.id,
        customerId: cust1.id,
        productId: pDell5420.id,
        serializedItemId: snDellSold.id,
        warrantyStart: sale1Date,
        warrantyEnd: calculateWarrantyEndDate(sale1Date, 3),
        durationMonths: 3,
        warrantyTerms: '3 months hardware checking warranty.',
        status: 'ACTIVE',
      },
    });

    const sale2Date = daysAgo(2, 12, 45);
    const sale2 = await tx.sale.create({
      data: {
        invoiceNumber: 'TE-INV-1002',
        customerId: cust3.id,
        saleDate: sale2Date,
        subtotal: 18500,
        discount: 500,
        totalAmount: 18000,
        totalCost: 13500,
        grossProfit: 4500,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        notes: 'Education Chromebook unit',
      },
    });
    const si2 = await tx.saleItem.create({
      data: {
        saleId: sale2.id,
        productId: pChromebook.id,
        serializedItemId: snCbSold.id,
        quantity: 1,
        unitPrice: 18500,
        unitCost: 13500,
        discount: 0,
        totalAmount: 18500,
        warrantyMonths: 1,
      },
    });
    await tx.warranty.create({
      data: {
        saleId: sale2.id,
        saleItemId: si2.id,
        customerId: cust3.id,
        productId: pChromebook.id,
        serializedItemId: snCbSold.id,
        warrantyStart: sale2Date,
        warrantyEnd: calculateWarrantyEndDate(sale2Date, 1),
        durationMonths: 1,
        warrantyTerms: '1 month checking warranty.',
        status: 'ACTIVE',
      },
    });

    const sale3Date = daysAgo(0, 10, 30);
    const sale3 = await tx.sale.create({
      data: {
        invoiceNumber: 'TE-INV-1003',
        customerId: cust2.id,
        saleDate: sale3Date,
        subtotal: 15600,
        discount: 600,
        totalAmount: 15000,
        totalCost: 11000,
        grossProfit: 4000,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        notes: 'SSD upgrade + 2 chargers',
      },
    });
    await tx.saleItem.createMany({
      data: [
        {
          saleId: sale3.id,
          productId: pNvme512.id,
          quantity: 1,
          unitPrice: 9200,
          unitCost: 6800,
          discount: 0,
          totalAmount: 9200,
          warrantyMonths: 6,
        },
        {
          saleId: sale3.id,
          productId: pCharger65W.id,
          quantity: 2,
          unitPrice: 3200,
          unitCost: 2100,
          discount: 0,
          totalAmount: 6400,
          warrantyMonths: 1,
        },
      ],
    });

    // Stock movements log
    await tx.stockMovement.createMany({
      data: [
        {
          productId: pDell5420.id,
          movementType: 'PURCHASE',
          quantity: 4,
          referenceType: 'PURCHASE',
          referenceId: pur1.id,
          previousStock: 0,
          newStock: 4,
          reason: 'Purchase TE-PUR-1001',
          createdAt: daysAgo(9, 11, 30),
        },
        {
          productId: pDell5420.id,
          serializedItemId: snDellSold.id,
          movementType: 'SALE',
          quantity: 1,
          referenceType: 'SALE',
          referenceId: sale1.id,
          previousStock: 4,
          newStock: 3,
          reason: 'Sale TE-INV-1001 (SN: DL5420-8841)',
          createdAt: sale1Date,
        },
        {
          productId: pChromebook.id,
          serializedItemId: snCbSold.id,
          movementType: 'SALE',
          quantity: 1,
          referenceType: 'SALE',
          referenceId: sale2.id,
          previousStock: 4,
          newStock: 3,
          reason: 'Sale TE-INV-1002 (SN: CB3100-101)',
          createdAt: sale2Date,
        },
        {
          productId: pNvme512.id,
          movementType: 'SALE',
          quantity: 1,
          referenceType: 'SALE',
          referenceId: sale3.id,
          previousStock: 4,
          newStock: 3,
          reason: 'Sale TE-INV-1003',
          createdAt: sale3Date,
        },
        {
          productId: pCharger65W.id,
          movementType: 'SALE',
          quantity: 2,
          referenceType: 'SALE',
          referenceId: sale3.id,
          previousStock: 14,
          newStock: 12,
          reason: 'Sale TE-INV-1003',
          createdAt: sale3Date,
        },
      ],
    });

    // Expenses
    const rentCat = expCatByName.get('Rent') ?? expenseCategories[0].id;
    const elecCat = expCatByName.get('Electricity') ?? expenseCategories[0].id;
    const netCat = expCatByName.get('Internet') ?? expenseCategories[0].id;

    await tx.expense.createMany({
      data: [
        {
          title: 'Shop Monthly Rent (Muneer Chowk #152)',
          categoryId: rentCat,
          amount: 18000,
          expenseDate: daysAgo(7, 10, 0),
          description: 'Monthly shop rent payment',
        },
        {
          title: 'LESCO Electricity Bill',
          categoryId: elecCat,
          amount: 7400,
          expenseDate: daysAgo(3, 11, 0),
          description: 'Shop meter billing cycle',
        },
        {
          title: 'Fiber Internet Connection',
          categoryId: netCat,
          amount: 2500,
          expenseDate: daysAgo(1, 14, 0),
          description: 'Monthly broadband subscription',
        },
      ],
    });
  });
}
