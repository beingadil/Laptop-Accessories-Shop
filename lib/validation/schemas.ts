import { z } from 'zod';

// Calendar-date field: must be non-empty and parseable (ISO yyyy-mm-dd or full ISO datetime).
const dateField = (message: string) =>
  z.string().min(1, message).refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date');

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(80),
  description: z.string().trim().max(300).optional().nullable(),
  defaultInventoryType: z.enum(['SERIALIZED', 'QUANTITY']).default('QUANTITY'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required').max(160),
  sku: z.string().trim().min(2, 'SKU is required').max(60),
  categoryId: z.string().min(1, 'Category is required'),
  // Optional everywhere in the UI — empty/missing are normalized to ''
  // because the DB column is NOT NULL. Bags, cables, etc. have no brand/model.
  brand: z.string().trim().max(80).optional().nullable().transform((v) => v ?? ''),
  model: z.string().trim().max(120).optional().nullable().transform((v) => v ?? ''),
  processor: z.string().trim().max(120).optional().nullable(),
  ram: z.string().trim().max(60).optional().nullable(),
  ssd: z.string().trim().max(60).optional().nullable(),
  hdd: z.string().trim().max(60).optional().nullable(),
  storage: z.string().trim().max(60).optional().nullable(),
  screenSize: z.string().trim().max(40).optional().nullable(),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).default('USED'),
  description: z.string().trim().max(1000).optional().nullable(),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be 0 or greater'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be 0 or greater'),
  minimumStock: z.coerce.number().int().min(0, 'Minimum stock must be 0 or greater').default(3),
  inventoryType: z.enum(['SERIALIZED', 'QUANTITY']),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const openingStockSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  date: z.string().min(1, 'Date is required'),
  purchasePrice: z.coerce.number().min(0, 'Purchase cost must be 0 or greater'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be 0 or greater'),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).default('USED'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  adjustmentType: z.enum([
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGED',
    'LOST',
  ]),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  serializedItemId: z.string().optional().nullable(),
  reason: z.string().trim().min(2, 'Reason is required').max(400),
  date: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(120),
  phone: z.string().trim().min(7, 'Phone number is required').max(30),
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required').max(120),
  phone: z.string().trim().min(7, 'Phone number is required').max(30),
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.coerce.number().min(0, 'Unit cost must be 0 or greater'),
  sellingPrice: z.coerce.number().min(0).optional(),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).default('USED'),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
});

export const purchaseSchema = z.object({
  purchaseNumber: z.string().trim().min(2).max(60).optional(),
  supplierId: z.string().min(1, 'Supplier is required'),
  purchaseDate: dateField('Purchase date is required'),
  paidAmount: z.coerce.number().min(0, 'Paid amount cannot be negative').default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one item is required'),
});

export const supplierPaymentSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  paymentDate: dateField('Payment date is required'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.literal('CASH').default('CASH'),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  serializedItemId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or greater'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  warrantyMonths: z.coerce.number().int().min(0).max(60).default(0),
});

export const saleSchema = z.object({
  invoiceNumber: z.string().trim().min(2).max(60).optional(),
  customerId: z.string().optional().nullable(),
  walkInCustomerName: z.string().trim().max(120).optional().nullable(),
  walkInCustomerPhone: z.string().trim().max(30).optional().nullable(),
  saleDate: dateField('Sale date is required'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  paymentMethod: z.literal('CASH').default('CASH'),
  notes: z.string().trim().max(600).optional().nullable(),
  items: z.array(saleItemInputSchema).min(1, 'At least one item is required'),
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(80),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const expenseSchema = z.object({
  title: z.string().trim().min(2, 'Expense title is required').max(140),
  categoryId: z.string().min(1, 'Expense category is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expenseDate: dateField('Expense date is required'),
  description: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const returnItemInputSchema = z.object({
  saleItemId: z.string().min(1, 'Sale item is required'),
  quantity: z.coerce.number().int().min(1, 'Return quantity must be at least 1'),
  restockStatus: z.enum(['RESTOCKED', 'DAMAGED']),
  condition: z.string().trim().max(100).optional().nullable(),
  refundAmount: z.coerce.number().min(0, 'Refund amount cannot be negative'),
});

export const returnSchema = z.object({
  originalSaleId: z.string().min(1, 'Original sale is required'),
  returnDate: dateField('Return date is required'),
  reason: z.enum(['DEFECTIVE', 'CHANGED_MIND', 'WRONG_PRODUCT', 'OTHER']),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(returnItemInputSchema).min(1, 'Select at least one item to return'),
});

export const exchangeReplacementInputSchema = z.object({
  productId: z.string().min(1, 'Replacement product is required'),
  serializedItemId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
});

export const exchangeSchema = z.object({
  originalSaleId: z.string().min(1, 'Original sale is required'),
  returnDate: dateField('Exchange date is required'),
  reason: z.enum(['DEFECTIVE', 'CHANGED_MIND', 'WRONG_PRODUCT', 'OTHER']),
  notes: z.string().trim().max(500).optional().nullable(),
  returnedItems: z.array(returnItemInputSchema).min(1, 'Select at least one returned item'),
  replacementItems: z.array(exchangeReplacementInputSchema).min(1, 'Select at least one replacement item'),
});

export const settingsSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(240),
  phone1: z.string().trim().min(7).max(30),
  phone2: z.string().trim().max(30).optional().nullable(),
  // Base64 data URL for the shop logo. Cap at ~1.4 MB (≈1 MB binary) so a huge
  // paste cannot bloat SQLite or every settings/branding payload.
  logoDataUrl: z.string().max(1_500_000).optional().nullable(),
  invoicePrefix: z.string().trim().min(1).max(20),
  purchasePrefix: z.string().trim().min(1).max(20),
  invoiceFooter: z.string().trim().max(500),
  warrantyTerms: z.string().trim().max(800),
  showWarrantyOnInvoice: z.boolean().default(true),
  defaultMinStock: z.coerce.number().int().min(0).default(3),
  lowStockAlertsEnabled: z.boolean().default(true),
  backupDirectory: z.string().trim().max(400).optional().default(''),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});

export const changePasswordSchema = z.object({
  username: z.string().trim().min(2).max(60).optional(),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
  confirmPassword: z.string().min(1, 'Please confirm new password'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
