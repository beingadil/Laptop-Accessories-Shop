import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeneralLedgerEntries,
  ledgerPeriodEntries,
  ledgerOpeningBalance,
  type GeneralLedgerSupplier,
  type GeneralLedgerCustomer,
  type GeneralLedgerPurchase,
  type GeneralLedgerPayment,
  type GeneralLedgerSale,
  type GeneralLedgerReturn,
} from './general-ledger.ts';

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

const suppliers: GeneralLedgerSupplier[] = [
  { id: 's1', name: 'Alpha Supplies', phone: '03001111111', address: 'Lahore', openingBalance: 50000, outstandingBalance: 0, createdAt: day('2026-01-01') },
  { id: 's2', name: 'Beta Trade', phone: '03002222222', address: 'Karachi', openingBalance: 0, outstandingBalance: 0, createdAt: day('2026-01-02') },
];
const customers: GeneralLedgerCustomer[] = [
  { id: 'c1', name: 'Ali Store', phone: '03111111111', address: 'Lahore', createdAt: day('2026-01-03') },
];
const purchases: GeneralLedgerPurchase[] = [
  { id: 'p1', purchaseNumber: 'TE-PUR-1001', supplierId: 's1', purchaseDate: day('2026-01-05'), totalAmount: 120000, status: 'COMPLETED' },
];
const payments: GeneralLedgerPayment[] = [
  { id: 'pay1', supplierId: 's1', paymentDate: day('2026-01-10'), amount: 30000, paymentMethod: 'CASH', referenceNumber: 'PAY-AAA111', status: 'COMPLETED' },
];
const sales: GeneralLedgerSale[] = [
  { id: 'sale1', invoiceNumber: 'TE-INV-1001', customerId: null, walkInCustomerName: 'Walk-in', saleDate: day('2026-01-06'), totalAmount: 45000, status: 'COMPLETED' },
  { id: 'sale2', invoiceNumber: 'TE-INV-1002', customerId: 'c1', saleDate: day('2026-01-07'), totalAmount: 30000, status: 'COMPLETED' },
];
const returns: GeneralLedgerReturn[] = [
  { id: 'ret1', returnNumber: 'TE-RET-1001', customerId: 'c1', returnDate: day('2026-01-09'), refundAmount: 10000 },
];

test('all accounts: entries walk per-account, suppliers first then customers', () => {
  const out = buildGeneralLedgerEntries({ suppliers, customers, purchases, payments, sales, returns, account: { kind: 'all' } });
  const sup = out.find((e) => e.entryType === 'OPENING_BALANCE');
  assert.equal(sup?.accountKey, 'supplier:s1');
  const c1 = out.filter((e) => e.accountKey === 'customer:c1');
  assert.equal(c1.length, 2); // sale + return
  assert.equal(c1[0].runningBalance, 30000);
  assert.equal(c1[1].runningBalance, 20000);
  const walkin = out.filter((e) => e.accountKey === 'walkin');
  assert.equal(walkin.length, 1);
  assert.equal(walkin[0].runningBalance, 45000);
});

test('cancelled sales and purchases are excluded', () => {
  const out = buildGeneralLedgerEntries({
    suppliers,
    customers,
    purchases: [...purchases, { id: 'pX', purchaseNumber: 'TE-PUR-1009', supplierId: 's1', purchaseDate: day('2026-01-07'), totalAmount: 999999, status: 'CANCELLED' }],
    payments: [],
    sales: [...sales, { id: 'saleX', invoiceNumber: 'TE-INV-1009', customerId: null, walkInCustomerName: null, saleDate: day('2026-01-08'), totalAmount: 777777, status: 'CANCELLED' }],
    returns: [],
    account: { kind: 'all' },
  });
  assert.ok(!out.some((e) => e.referenceNumber === 'TE-PUR-1009'));
  assert.ok(!out.some((e) => e.referenceNumber === 'TE-INV-1009'));
});

test('supplier filter isolates exactly that supplier with correct running balance', () => {
  const out = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns,
    account: { kind: 'supplier', id: 's1' },
  });
  assert.ok(out.every((e) => e.accountKey === 'supplier:s1'));
  assert.deepEqual(out.map((e) => e.runningBalance), [50000, 170000, 140000]);
});

test('customer filter shows sale then sale return with correct balances', () => {
  const out = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns,
    account: { kind: 'customer', id: 'c1' },
  });
  assert.deepEqual(out.map((e) => [e.entryType, e.runningBalance]), [
    ['SALE', 30000],
    ['SALE_RETURN', 20000],
  ]);
});

test('walk-ins filter shows only walk-in sales', () => {
  const out = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns,
    account: { kind: 'walk-ins' },
  });
  assert.ok(out.every((e) => e.accountKey === 'walkin'));
  assert.equal(out[0].referenceNumber, 'TE-INV-1001');
});

test('all-suppliers filter excludes customer entries', () => {
  const out = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns,
    account: { kind: 'all-suppliers' },
  });
  assert.ok(out.every((e) => e.accountKind === 'supplier'));
  assert.ok(out.length >= 3);
});

test('period walk: opening b/f then one cumulative net down the page', () => {
  const all = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns, account: { kind: 'all' },
  });
  const from = '2026-01-08';
  const opening = ledgerOpeningBalance(all, from);
  // Pre-range: s1 opening 50k + purchase 120k + walk-in sale 45k + c1 sale 30k = 245k
  assert.equal(opening, 245000);
  const period = ledgerPeriodEntries(all, from, '2026-01-31', opening);
  // In range: sale return (−10k) then payment (−30k) — one running net
  assert.deepEqual(period.map((e) => [e.entryType, e.runningBalance]), [
    ['SALE_RETURN', 235000],
    ['PAYMENT', 205000],
  ]);
});

test('period walk scoped to one supplier: b/f carries, then running balance accumulates', () => {
  const scoped = buildGeneralLedgerEntries({
    suppliers, customers, purchases, payments, sales, returns, account: { kind: 'supplier', id: 's1' },
  });
  const opening = ledgerOpeningBalance(scoped, '2026-01-08');
  // s1 pre-range: opening 50k + purchase 120k = 170k
  assert.equal(opening, 170000);
  const period = ledgerPeriodEntries(scoped, '2026-01-08', '2026-01-31', opening);
  assert.deepEqual(period.map((e) => [e.entryType, e.runningBalance]), [
    ['PAYMENT', 140000],
  ]);
});

test('empty input yields empty ledger', () => {
  const out = buildGeneralLedgerEntries({ suppliers: [], customers: [], purchases: [], payments: [], sales: [], returns: [], account: { kind: 'all' } });
  assert.deepEqual(out, []);
});
