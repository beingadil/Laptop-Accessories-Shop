import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeightedAverageCost,
  calculateSaleTotals,
  calculateNetProfit,
  calculateSupplierOutstanding,
  calculateExchangeSummary,
  calculateWarrantyEndDate,
  isWarrantyActive,
  validateUniqueSerials,
  validateStockDeduction,
} from './calculations.ts';

test('weighted average cost computes accurately on restock', () => {
  assert.equal(calculateWeightedAverageCost(10, 1500, 10, 2000), 1750);
  assert.equal(calculateWeightedAverageCost(0, 0, 5, 42000), 42000);
});

test('sale totals and gross profit deduct discounts and cost accurately', () => {
  const result = calculateSaleTotals(
    [
      { quantity: 1, unitPrice: 68000, unitCost: 55000, discount: 1000 },
      { quantity: 2, unitPrice: 3500, unitCost: 2200, discount: 0 },
    ],
    2000
  );
  // Line 1 net = 67000, Line 2 net = 7000, subtotal = 74000
  // Total after invoice discount (2000) = 72000
  // Total cost = 55000 + 4400 = 59400
  // Gross profit = 72000 - 59400 = 12600
  assert.equal(result.subtotal, 74000);
  assert.equal(result.totalAmount, 72000);
  assert.equal(result.totalCost, 59400);
  assert.equal(result.grossProfit, 12600);
});

test('net profit accounts for return adjustments and shop expenses', () => {
  const net = calculateNetProfit({
    grossSalesProfit: 120000,
    returnProfitAdjustments: -8000,
    totalExpenses: 35000,
  });
  assert.equal(net, 77000);
});

test('supplier outstanding balance prevents negative balance and computes correctly', () => {
  assert.equal(
    calculateSupplierOutstanding({
      openingBalance: 50000,
      purchasesOutstandingSum: 150000,
      paymentsSum: 80000,
    }),
    120000
  );
  assert.equal(
    calculateSupplierOutstanding({
      openingBalance: 0,
      purchasesOutstandingSum: 20000,
      paymentsSum: 25000,
    }),
    0
  );
});

test('exchange summary computes price difference and profit adjustment for restocked vs damaged', () => {
  const restocked = calculateExchangeSummary({
    returnedValue: 50000,
    returnedCost: 40000,
    restocked: true,
    replacementValue: 65000,
    replacementCost: 52000,
  });
  assert.equal(restocked.priceDifference, 15000);
  assert.equal(restocked.extraPaymentReceived, 15000);
  assert.equal(restocked.refundAmount, 0);
  // Replacement profit (13000) - Original profit (10000) = +3000
  assert.equal(restocked.profitAdjustment, 3000);

  const damaged = calculateExchangeSummary({
    returnedValue: 50000,
    returnedCost: 40000,
    restocked: false,
    replacementValue: 50000,
    replacementCost: 40000,
  });
  assert.equal(damaged.priceDifference, 0);
  // Since returned item is damaged (cost not recovered), profit adjustment = (50k-40k) - (50k-0) = -40000
  assert.equal(damaged.profitAdjustment, -40000);
});

test('warranty end date and active checks', () => {
  const start = new Date('2026-01-15T00:00:00Z');
  const end = calculateWarrantyEndDate(start, 6);
  assert.equal(end.toISOString().slice(0, 10), '2026-07-15');
  assert.equal(isWarrantyActive(end, 'ACTIVE', new Date('2026-06-01T00:00:00Z')), true);
  assert.equal(isWarrantyActive(end, 'ACTIVE', new Date('2026-08-01T00:00:00Z')), false);
  assert.equal(isWarrantyActive(end, 'VOID', new Date('2026-06-01T00:00:00Z')), false);
});

test('serial uniqueness and stock deduction prevent invalid operations', () => {
  assert.equal(validateUniqueSerials(['SN-1', 'SN-2', 'sn-1']).valid, false);
  assert.equal(validateUniqueSerials(['SN-1', 'SN-2']).valid, true);
  assert.equal(validateStockDeduction(5, 5), true);
  assert.equal(validateStockDeduction(5, 6), false);
  assert.equal(validateStockDeduction(0, 1), false);
});
