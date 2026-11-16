export interface SaleItemCalculationInput {
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
}

export interface SaleTotalsResult {
  subtotal: number;
  itemDiscountTotal: number;
  invoiceDiscount: number;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
}

export function calculateWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  addedQty: number,
  addedUnitCost: number
): number {
  if (addedQty <= 0) return Math.max(0, currentAvgCost);
  const safeCurrentQty = Math.max(0, currentQty);
  const totalQty = safeCurrentQty + addedQty;
  if (totalQty <= 0) return Math.max(0, addedUnitCost);
  const totalValue = safeCurrentQty * Math.max(0, currentAvgCost) + addedQty * Math.max(0, addedUnitCost);
  return Math.round((totalValue / totalQty) * 100) / 100;
}

export function calculateSaleLineTotal(input: SaleItemCalculationInput): {
  grossLine: number;
  netLine: number;
  lineCost: number;
  lineProfit: number;
} {
  const qty = Math.max(0, input.quantity);
  const price = Math.max(0, input.unitPrice);
  const cost = Math.max(0, input.unitCost);
  const discount = Math.max(0, input.discount);

  const grossLine = qty * price;
  const netLine = Math.max(0, grossLine - discount);
  const lineCost = qty * cost;
  const lineProfit = netLine - lineCost;

  return { grossLine, netLine, lineCost, lineProfit };
}

export function calculateSaleTotals(
  items: SaleItemCalculationInput[],
  invoiceDiscount = 0
): SaleTotalsResult {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let totalCost = 0;

  for (const item of items) {
    const line = calculateSaleLineTotal(item);
    subtotal += line.netLine;
    itemDiscountTotal += Math.max(0, item.discount);
    totalCost += line.lineCost;
  }

  const safeInvoiceDiscount = Math.max(0, invoiceDiscount);
  const totalAmount = Math.max(0, subtotal - safeInvoiceDiscount);
  const grossProfit = totalAmount - totalCost;

  return {
    subtotal,
    itemDiscountTotal,
    invoiceDiscount: safeInvoiceDiscount,
    totalAmount,
    totalCost,
    grossProfit,
  };
}

export function calculateNetProfit(params: {
  grossSalesProfit: number;
  returnProfitAdjustments: number;
  totalExpenses: number;
}): number {
  return params.grossSalesProfit + params.returnProfitAdjustments - params.totalExpenses;
}

export function calculateSupplierOutstanding(params: {
  openingBalance: number;
  purchasesOutstandingSum: number;
  paymentsSum: number;
}): number {
  return Math.max(
    0,
    Math.round((params.openingBalance + params.purchasesOutstandingSum - params.paymentsSum) * 100) / 100
  );
}

export function calculateExchangeSummary(params: {
  returnedValue: number;
  returnedCost: number;
  restocked: boolean;
  replacementValue: number;
  replacementCost: number;
}): {
  priceDifference: number;
  refundAmount: number;
  extraPaymentReceived: number;
  profitAdjustment: number;
} {
  const priceDifference = params.replacementValue - params.returnedValue;
  const refundAmount = priceDifference < 0 ? Math.abs(priceDifference) : 0;
  const extraPaymentReceived = priceDifference > 0 ? priceDifference : 0;

  // Net revenue change = replacementValue - returnedValue
  // Net COGS change = replacementCost - (restocked ? returnedCost : 0)
  // So profit change = (replacementValue - replacementCost) - (returnedValue - (restocked ? returnedCost : 0))
  const recoveredCost = params.restocked ? params.returnedCost : 0;
  const profitAdjustment = (params.replacementValue - params.replacementCost) - (params.returnedValue - recoveredCost);

  return {
    priceDifference,
    refundAmount,
    extraPaymentReceived,
    profitAdjustment,
  };
}

export function calculateWarrantyEndDate(startDate: Date, durationMonths: number): Date {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + Math.max(0, durationMonths));
  return end;
}

export function isWarrantyActive(endDate: Date, status: string, now = new Date()): boolean {
  if (status === 'VOID') return false;
  return endDate.getTime() >= now.getTime();
}

export function validateUniqueSerials(serials: string[]): { valid: boolean; duplicates: string[] } {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const raw of serials) {
    const clean = raw.trim().toUpperCase();
    if (!clean) continue;
    if (seen.has(clean)) {
      duplicates.add(raw.trim());
    }
    seen.add(clean);
  }
  return { valid: duplicates.size === 0, duplicates: Array.from(duplicates) };
}

export function validateStockDeduction(currentStock: number, requestedQty: number): boolean {
  return requestedQty > 0 && currentStock >= requestedQty;
}
