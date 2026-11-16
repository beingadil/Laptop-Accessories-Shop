import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError, parseDateParam, BusinessRuleError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import {
  buildGeneralLedgerEntries,
  ledgerOpeningBalance,
  ledgerPeriodEntries,
  type LedgerAccountKind,
} from '@/lib/domain/general-ledger';

// GET /api/ledger?account=all|all-suppliers|supplier:<id>|walkin|all-customers|customer:<id>&from=&to=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const accountParam = url.searchParams.get('account') || 'all';
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';

    const fromDate = from ? parseDateParam(from, 'from') : undefined;
    const toDate = to ? parseDateParam(to, 'to', true) : undefined;
    const fromKey = fromDate ? fromDate.toISOString().slice(0, 10) : undefined;
    const toKey = toDate ? toDate.toISOString().slice(0, 10) : undefined;

    let account: { kind: LedgerAccountKind; id?: string };
    if (accountParam === 'all') account = { kind: 'all' };
    else if (accountParam === 'all-suppliers') account = { kind: 'all-suppliers' };
    else if (accountParam === 'all-customers') account = { kind: 'all-customers' };
    else if (accountParam === 'walkin') account = { kind: 'walk-ins' };
    else if (accountParam.startsWith('supplier:')) account = { kind: 'supplier', id: accountParam.slice('supplier:'.length) };
    else if (accountParam.startsWith('customer:')) account = { kind: 'customer', id: accountParam.slice('customer:'.length) };
    else throw new BusinessRuleError(`Unknown account "${accountParam}".`);

    const [suppliers, customers, purchases, payments, sales, returns] = await Promise.all([
      prisma.supplier.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          openingBalance: true,
          outstandingBalance: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.customer.findMany({
        select: { id: true, name: true, phone: true, address: true, createdAt: true },
        orderBy: { name: 'asc' },
      }),
      prisma.purchase.findMany({
        where: { status: 'COMPLETED' },
        select: { id: true, purchaseNumber: true, supplierId: true, purchaseDate: true, totalAmount: true, status: true },
      }),
      prisma.supplierPayment.findMany({
        where: { status: 'COMPLETED' },
        select: { id: true, supplierId: true, paymentDate: true, amount: true, paymentMethod: true, referenceNumber: true, status: true },
      }),
      prisma.sale.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { id: true, invoiceNumber: true, customerId: true, walkInCustomerName: true, saleDate: true, totalAmount: true, status: true },
      }),
      prisma.return.findMany({
        select: { id: true, returnNumber: true, customerId: true, returnDate: true, refundAmount: true },
      }),
    ]);

    const scopedAll = buildGeneralLedgerEntries({
      suppliers,
      customers,
      purchases,
      payments,
      sales,
      returns,
      account: { kind: 'all' }, // walk global so all rows are computed, then scope for the view
    });

    const scoped = account.kind === 'all' ? scopedAll : scopedAll.filter((e) => {
      if (account.kind === 'all-suppliers') return e.accountKind === 'supplier';
      if (account.kind === 'all-customers') return e.accountKey === 'walkin' || e.accountKind === 'customer';
      if (account.kind === 'walk-ins') return e.accountKey === 'walkin';
      if (account.kind === 'supplier') return e.accountKey === `supplier:${account.id}`;
      return e.accountKey === `customer:${account.id}`;
    });

    const openingBalance = ledgerOpeningBalance(scoped, fromKey ?? '');
    const entries = ledgerPeriodEntries(scoped, fromKey, toKey, openingBalance);

    const totals = entries.reduce(
      (acc, e) => {
        acc.debit += e.debit;
        acc.credit += e.credit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    const selected =
      account.kind === 'all'
        ? null
        : account.kind === 'all-suppliers' || account.kind === 'all-customers' || account.kind === 'walk-ins'
        ? { kind: account.kind, name: account.kind === 'all-suppliers' ? 'All Suppliers' : account.kind === 'all-customers' ? 'All Customers' : 'Walk-in Customers' }
        : account.kind === 'supplier'
        ? { ...(suppliers.find((s) => s.id === account.id) ?? { id: '', name: 'Unknown supplier', phone: null, address: null, openingBalance: 0, outstandingBalance: 0, createdAt: new Date() }), kind: 'supplier' as const }
        : { ...(customers.find((c) => c.id === account.id) ?? { id: '', name: 'Unknown customer', phone: null, address: null, createdAt: new Date() }), kind: 'customer' as const };

    const supplierOutstanding = suppliers.reduce((s, x) => s + x.outstandingBalance, 0);
    const periodSales = sales
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((s, x) => s + x.totalAmount, 0);
    const periodPurchases = purchases
      .filter((p) => p.status === 'COMPLETED')
      .reduce((s, x) => s + x.totalAmount, 0);

    return NextResponse.json({
      suppliers,
      customers,
      entries,
      totals,
      openingBalance,
      closingBalance: openingBalance + totals.debit - totals.credit,
      supplierOutstanding,
      periodSales,
      periodPurchases,
      selected,
      accountKind: account.kind,
      count: entries.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
