/**
 * General Ledger — posting engine (accounts receivable + accounts payable).
 *
 * One row per business posting, grouped into account chains. Sign convention:
 *   - Suppliers:  Debit = money owed to supplier increased (purchase, opening
 *     payable), Credit = money paid/credited (payment, credit note, refund).
 *   - Customers:  Debit = money owed by customer increased (sale invoice),
 *     Credit = money settled/refunded (return).
 *
 * The function is pure — feed it rows, get ordered entries back with correct
 * running balances. No DB access, fully unit-testable.
 */

export type LedgerAccountKind =
  | 'all'
  | 'all-suppliers'
  | 'supplier'
  | 'walk-ins'
  | 'all-customers'
  | 'customer';

export type GeneralLedgerEntryType =
  | 'OPENING_BALANCE'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'ADVANCE_PAYMENT'
  | 'SALE'
  | 'SALE_RETURN'
  | 'CREDIT_NOTE'
  | 'DEBIT_ADJUSTMENT'
  | 'REFUND'
  | 'WRITE_OFF';

export interface GeneralLedgerSupplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  openingBalance: number;
  outstandingBalance: number;
  createdAt: Date;
}

export interface GeneralLedgerCustomer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}

export interface GeneralLedgerPurchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  purchaseDate: Date;
  totalAmount: number;
  status: string;
}

export interface GeneralLedgerPayment {
  id: string;
  supplierId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  status?: string;
}

export interface GeneralLedgerAdjustment {
  id: string;
  supplierId: string;
  type: 'CREDIT_NOTE' | 'DEBIT_ADJUSTMENT' | 'REFUND' | 'WRITE_OFF';
  amount: number;
  date: Date;
  reason?: string | null;
  referenceNumber?: string | null;
}

export interface GeneralLedgerSale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  walkInCustomerName?: string | null;
  saleDate: Date;
  totalAmount: number;
  status: string;
}

export interface GeneralLedgerReturn {
  id: string;
  returnNumber: string;
  customerId: string | null;
  returnDate: Date;
  refundAmount: number;
}

export interface GeneralLedgerEntry {
  id: string;
  postedAt: number;
  date: string; // YYYY-MM-DD
  accountKey: string; // 'supplier:{id}' | 'customer:{id}' | 'walkin'
  accountName: string;
  accountKind: 'supplier' | 'customer' | 'walk-ins';
  entryType: GeneralLedgerEntryType;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerInput {
  suppliers: GeneralLedgerSupplier[];
  purchases: GeneralLedgerPurchase[];
  payments: GeneralLedgerPayment[];
  adjustments?: GeneralLedgerAdjustment[];
  customers?: GeneralLedgerCustomer[];
  sales?: GeneralLedgerSale[];
  returns?: GeneralLedgerReturn[];
  account?: { kind: LedgerAccountKind; id?: string };
}

const toDateKey = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '1970-01-01';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const paymentMethodLabel = (m?: string | null): string => {
  switch ((m || '').toUpperCase()) {
    case 'CASH':
      return 'Cash';
    case 'BANK':
    case 'BANK_TRANSFER':
    case 'TRANSFER':
      return 'Bank Transfer';
    case 'CHEQUE':
      return 'Cheque';
    case 'EASYPAISA':
      return 'Easypaisa';
    case 'JAZZCASH':
      return 'JazzCash';
    default:
      return m ? String(m) : 'Payment';
  }
};

const accountKeyFor = (kind: 'supplier' | 'customer' | 'walk-ins', id?: string | null) =>
  kind === 'walk-ins' ? 'walkin' : `${kind}:${id}`;

const typeRank = (t: GeneralLedgerEntryType): number =>
  t === 'OPENING_BALANCE' ? 0
  : t === 'PURCHASE' ? 1
  : t === 'SALE' ? 2
  : t === 'ADVANCE_PAYMENT' ? 3
  : t === 'PAYMENT' ? 4
  : t === 'SALE_RETURN' ? 5
  : t === 'CREDIT_NOTE' ? 6
  : t === 'REFUND' ? 7
  : t === 'DEBIT_ADJUSTMENT' ? 8
  : 9;

function matchesAccount(
  account: { kind: LedgerAccountKind; id?: string } | undefined,
  key: string
): boolean {
  if (!account || account.kind === 'all') return true;
  if (account.kind === 'all-suppliers') return key.startsWith('supplier:');
  if (account.kind === 'all-customers') return key === 'walkin' || key.startsWith('customer:');
  if (account.kind === 'walk-ins') return key === 'walkin';
  if (account.kind === 'supplier') return key === `supplier:${account.id}`;
  if (account.kind === 'customer') return key === `customer:${account.id}`;
  return true;
}

export function buildGeneralLedgerEntries(input: GeneralLedgerInput): GeneralLedgerEntry[] {
  const {
    suppliers,
    purchases,
    payments,
    adjustments = [],
    customers = [],
    sales = [],
    returns = [],
    account,
  } = input;
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const raw: Array<Omit<GeneralLedgerEntry, 'runningBalance'>> = [];

  const push = (e: Omit<GeneralLedgerEntry, 'runningBalance'>) => {
    if (matchesAccount(account, e.accountKey)) raw.push(e);
  };

  // Rule 0 — supplier opening balance (payable).
  // "Balance brought forward" is the START of every statement chain, so it is
  // pinned to the very first line (postedAt epoch) rather than sorted by the
  // date the supplier record happened to be created. The displayed date stays
  // the real opening date (createdAt).
  for (const s of suppliers) {
    if (s.openingBalance === 0) continue;
    push({
      id: `open-sup-${s.id}`,
      postedAt: 0,
      date: toDateKey(s.createdAt),
      accountKey: `supplier:${s.id}`,
      accountName: s.name,
      accountKind: 'supplier',
      entryType: 'OPENING_BALANCE',
      referenceNumber: 'OPENING',
      description:
        s.openingBalance >= 0
          ? 'Opening balance brought forward (payable)'
          : 'Opening balance brought forward (advance)',
      debit: s.openingBalance > 0 ? s.openingBalance : 0,
      credit: s.openingBalance < 0 ? -s.openingBalance : 0,
    });
  }

  // Rule 1 — purchases → Debit (payables increase)
  for (const p of purchases) {
    if (p.status !== 'COMPLETED') continue;
    const s = supplierById.get(p.supplierId);
    push({
      id: `pur-${p.id}`,
      postedAt: new Date(p.purchaseDate).getTime(),
      date: toDateKey(p.purchaseDate),
      accountKey: `supplier:${p.supplierId}`,
      accountName: s?.name ?? 'Supplier',
      accountKind: 'supplier',
      entryType: 'PURCHASE',
      referenceNumber: p.purchaseNumber,
      description: 'Purchase — goods received',
      debit: p.totalAmount,
      credit: 0,
    });
  }

  // Rule 2 — supplier payments → Credit
  for (const p of payments) {
    if (p.status && p.status !== 'COMPLETED') continue;
    const s = supplierById.get(p.supplierId);
    push({
      id: `pay-${p.id}`,
      postedAt: new Date(p.paymentDate).getTime(),
      date: toDateKey(p.paymentDate),
      accountKey: `supplier:${p.supplierId}`,
      accountName: s?.name ?? 'Supplier',
      accountKind: 'supplier',
      entryType: 'PAYMENT',
      referenceNumber: p.referenceNumber || `PAY-${p.id.slice(0, 8).toUpperCase()}`,
      description: `Payment — ${paymentMethodLabel(p.paymentMethod)}`,
      debit: 0,
      credit: p.amount,
    });
  }

  // Rule 3 — sales → Debit (receivables increase / sales revenue)
  for (const s of sales) {
    if (s.status === 'CANCELLED') continue;
    const isCustomer = Boolean(s.customerId);
    const name = isCustomer
      ? customerById.get(s.customerId!)?.name ?? 'Customer'
      : s.walkInCustomerName?.trim() || 'Walk-in Customer';
    push({
      id: `sale-${s.id}`,
      postedAt: new Date(s.saleDate).getTime(),
      date: toDateKey(s.saleDate),
      accountKey: accountKeyFor(isCustomer ? 'customer' : 'walk-ins', s.customerId),
      accountName: name,
      accountKind: isCustomer ? 'customer' : 'walk-ins',
      entryType: 'SALE',
      referenceNumber: s.invoiceNumber,
      description: `Sale — ${s.invoiceNumber}`,
      debit: s.totalAmount,
      credit: 0,
    });
  }

  // Rule 4 — sale returns → Credit (reverse of sale)
  for (const r of returns) {
    const isCustomer = Boolean(r.customerId);
    const name = isCustomer
      ? customerById.get(r.customerId!)?.name ?? 'Customer'
      : 'Walk-in Customer';
    push({
      id: `ret-${r.id}`,
      postedAt: new Date(r.returnDate).getTime(),
      date: toDateKey(r.returnDate),
      accountKey: accountKeyFor(isCustomer ? 'customer' : 'walk-ins', r.customerId),
      accountName: name,
      accountKind: isCustomer ? 'customer' : 'walk-ins',
      entryType: 'SALE_RETURN',
      referenceNumber: r.returnNumber,
      description: `Return — ${r.returnNumber}`,
      debit: 0,
      credit: r.refundAmount,
    });
  }

  // Rule 5 — supplier adjustments
  for (const a of adjustments) {
    const s = supplierById.get(a.supplierId);
    const base = {
      id: `adj-${a.id}`,
      postedAt: new Date(a.date).getTime(),
      date: toDateKey(a.date),
      accountKey: `supplier:${a.supplierId}`,
      accountName: s?.name ?? 'Supplier',
      accountKind: 'supplier' as const,
      referenceNumber: a.referenceNumber || `ADJ-${a.id.slice(0, 8).toUpperCase()}`,
      description: a.reason?.trim() ||
        (a.type === 'CREDIT_NOTE' ? 'Credit note from supplier'
          : a.type === 'DEBIT_ADJUSTMENT' ? 'Debit adjustment'
          : a.type === 'REFUND' ? 'Supplier refund' : 'Write-off'),
    };
    if (a.type === 'CREDIT_NOTE') {
      push({ ...base, entryType: 'CREDIT_NOTE', debit: 0, credit: a.amount });
    } else if (a.type === 'REFUND') {
      push({ ...base, entryType: 'REFUND', debit: 0, credit: a.amount });
    } else if (a.type === 'DEBIT_ADJUSTMENT') {
      push({ ...base, entryType: 'DEBIT_ADJUSTMENT', debit: a.amount, credit: 0 });
    } else {
      push({ ...base, entryType: 'WRITE_OFF', debit: 0, credit: a.amount });
    }
  }

  raw.sort((a, b) =>
    a.postedAt === b.postedAt ? typeRank(a.entryType) - typeRank(b.entryType) : a.postedAt - b.postedAt
  );

  // Per-account running balance
  const running = new Map<string, number>();
  return raw.map((r) => {
    const next = (running.get(r.accountKey) ?? 0) + r.debit - r.credit;
    running.set(r.accountKey, next);
    return { ...r, runningBalance: next };
  });
}

/** Sum of (debit - credit) for entries BEFORE `from` — the "Balance b/f". */
export function ledgerOpeningBalance(entries: GeneralLedgerEntry[], from: string): number {
  return entries
    .filter((e) => e.date < from)
    .reduce((sum, e) => sum + e.debit - e.credit, 0);
}

/** Keep entries within [from, to]; accumulate ONE cumulative running balance
 *  seeded with `openingBalance` (the Balance brought forward). This makes the
 *  column arithmetically consistent down the page: every row is the previous
 *  row plus its Debit−Credit, and the final row equals the Closing Balance —
 *  for single accounts and for the combined global view alike. */
export function ledgerPeriodEntries(
  entries: GeneralLedgerEntry[],
  from: string | undefined,
  to: string | undefined,
  openingBalance: number
): GeneralLedgerEntry[] {
  const inRange = entries.filter(
    (e) => (!from || e.date >= from) && (!to || e.date <= to)
  );
  let running = openingBalance;
  return inRange.map((e) => {
    running += e.debit - e.credit;
    return { ...e, runningBalance: running };
  });
}
