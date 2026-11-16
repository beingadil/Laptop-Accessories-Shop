import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';

const EMPTY_RESULTS = {
  products: [],
  serials: [],
  sales: [],
  purchases: [],
  customers: [],
  suppliers: [],
  supplierPayments: [],
  expenses: [],
  returns: [],
  warranties: [],
  categories: [],
};

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json(EMPTY_RESULTS);
    }

    const [
      products,
      serials,
      sales,
      purchases,
      customers,
      suppliers,
      supplierPayments,
      expenses,
      returns,
      warranties,
      categories,
    ] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { brand: { contains: q } },
            { model: { contains: q } },
            { processor: { contains: q } },
            { ram: { contains: q } },
            { ssd: { contains: q } },
            { hdd: { contains: q } },
            { storage: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, sku: true, currentStock: true, sellingPrice: true },
      }),
      prisma.serializedInventoryItem.findMany({
        where: {
          OR: [
            { serialNumber: { contains: q } },
            { notes: { contains: q } },
            { product: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          serialNumber: true,
          stockStatus: true,
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.sale.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: q } },
            { walkInCustomerName: { contains: q } },
            { walkInCustomerPhone: { contains: q } },
            { notes: { contains: q } },
            { customer: { name: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { saleDate: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          saleDate: true,
          status: true,
          customer: { select: { name: true } },
          walkInCustomerName: true,
        },
      }),
      prisma.purchase.findMany({
        where: {
          OR: [
            { purchaseNumber: { contains: q } },
            { notes: { contains: q } },
            { supplier: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { purchaseDate: 'desc' },
        select: {
          id: true,
          purchaseNumber: true,
          totalAmount: true,
          outstandingAmount: true,
          supplier: { select: { name: true } },
        },
      }),
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
            { notes: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, phone: true, address: true },
      }),
      prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
            { notes: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, phone: true, outstandingBalance: true },
      }),
      prisma.supplierPayment.findMany({
        where: {
          status: 'COMPLETED',
          OR: [
            { referenceNumber: { contains: q } },
            { notes: { contains: q } },
            { supplier: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          referenceNumber: true,
          supplier: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { notes: { contains: q } },
            { category: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { expenseDate: 'desc' },
        select: {
          id: true,
          title: true,
          amount: true,
          category: { select: { name: true } },
        },
      }),
      prisma.return.findMany({
        where: {
          OR: [
            { returnNumber: { contains: q } },
            { notes: { contains: q } },
            { originalSale: { invoiceNumber: { contains: q } } },
            { customer: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { returnDate: 'desc' },
        select: {
          id: true,
          returnNumber: true,
          type: true,
          originalSaleId: true,
          originalSale: { select: { invoiceNumber: true } },
        },
      }),
      prisma.warranty.findMany({
        where: {
          OR: [
            { warrantyTerms: { contains: q } },
            { product: { name: { contains: q } } },
            { serializedItem: { serialNumber: { contains: q } } },
            { sale: { invoiceNumber: { contains: q } } },
            { customer: { name: { contains: q } } },
          ],
        },
        take: 5,
        orderBy: { warrantyEnd: 'desc' },
        select: {
          id: true,
          status: true,
          warrantyEnd: true,
          product: { select: { name: true } },
          serializedItem: { select: { serialNumber: true } },
          sale: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.productCategory.findMany({
        where: {
          OR: [{ name: { contains: q } }, { description: { contains: q } }],
        },
        take: 5,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          defaultInventoryType: true,
          _count: { select: { products: true } },
        },
      }),
    ]);

    return NextResponse.json({
      products,
      serials,
      sales,
      purchases,
      customers,
      suppliers,
      supplierPayments,
      expenses,
      returns,
      warranties,
      categories,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
