import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, parseDateParam } from '@/lib/api-utils';
import { parsePaginationParams } from '@/lib/format';
import { calculateNetProfit } from '@/lib/domain/calculations';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const reportType = url.searchParams.get('type') || 'sales';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const exportAll = url.searchParams.get('export') === '1';
    const { page, pageSize, search } = parsePaginationParams(url.searchParams);

    const dateRange =
      dateFrom || dateTo
        ? {
            ...(dateFrom ? { gte: parseDateParam(dateFrom, 'dateFrom') } : {}),
            ...(dateTo ? { lte: parseDateParam(dateTo, 'dateTo', true) } : {}),
          }
        : undefined;

    if (reportType === 'sales') {
      const where: Prisma.SaleWhereInput = {
        status: { not: 'CANCELLED' },
        ...(dateRange ? { saleDate: dateRange } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search } },
                { walkInCustomerName: { contains: search } },
                { customer: { name: { contains: search } } },
              ],
            }
          : {}),
      };
      const [total, items, agg] = await Promise.all([
        prisma.sale.count({ where }),
        prisma.sale.findMany({
          where,
          orderBy: { saleDate: 'desc' },
          ...(exportAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
          include: {
            customer: { select: { name: true, phone: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.sale.aggregate({
          where,
          _sum: { totalAmount: true, totalCost: true, grossProfit: true, discount: true },
        }),
      ]);

      return NextResponse.json({
        type: 'sales',
        summary: {
          count: total,
          totalRevenue: agg._sum.totalAmount ?? 0,
          totalCost: agg._sum.totalCost ?? 0,
          totalDiscount: agg._sum.discount ?? 0,
          grossProfit: agg._sum.grossProfit ?? 0,
        },
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    if (reportType === 'purchases') {
      const where: Prisma.PurchaseWhereInput = {
        status: 'COMPLETED',
        ...(dateRange ? { purchaseDate: dateRange } : {}),
        ...(search
          ? {
              OR: [
                { purchaseNumber: { contains: search } },
                { supplier: { name: { contains: search } } },
              ],
            }
          : {}),
      };
      const [total, items, agg] = await Promise.all([
        prisma.purchase.count({ where }),
        prisma.purchase.findMany({
          where,
          orderBy: { purchaseDate: 'desc' },
          ...(exportAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
          include: {
            supplier: { select: { name: true, phone: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.purchase.aggregate({
          where,
          _sum: { totalAmount: true, paidAmount: true, outstandingAmount: true },
        }),
      ]);

      return NextResponse.json({
        type: 'purchases',
        summary: {
          count: total,
          totalAmount: agg._sum.totalAmount ?? 0,
          paidAmount: agg._sum.paidAmount ?? 0,
          outstandingAmount: agg._sum.outstandingAmount ?? 0,
        },
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    if (reportType === 'inventory') {
      const stockState = url.searchParams.get('stockState') || '';
      const where: Prisma.ProductWhereInput = {
        status: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
                { brand: { contains: search } },
              ],
            }
          : {}),
        ...(stockState === 'OUT' ? { currentStock: 0 } : {}),
      };

      const allMatching = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { category: { select: { name: true } } },
      });

      const filtered =
        stockState === 'LOW'
          ? allMatching.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock)
          : allMatching;

      const totalStockUnits = filtered.reduce((sum, p) => sum + p.currentStock, 0);
      const totalStockValue = filtered.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);
      const totalRetailValue = filtered.reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);

      const total = filtered.length;
      const items = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

      return NextResponse.json({
        type: 'inventory',
        summary: {
          productCount: total,
          totalStockUnits,
          totalStockValue,
          totalRetailValue,
        },
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    if (reportType === 'financial') {
      const expenseWhere: Prisma.ExpenseWhereInput = {
        status: 'ACTIVE',
        ...(dateRange ? { expenseDate: dateRange } : {}),
        ...(search ? { title: { contains: search } } : {}),
      };
      const [salesAgg, returnsAgg, expensesAgg, totalExpensesCount, expenseItems, supplierAgg] =
        await Promise.all([
          prisma.sale.aggregate({
            where: { status: { not: 'CANCELLED' }, ...(dateRange ? { saleDate: dateRange } : {}) },
            _sum: { totalAmount: true, totalCost: true, grossProfit: true, discount: true },
            _count: { id: true },
          }),
          prisma.return.aggregate({
            where: { ...(dateRange ? { returnDate: dateRange } : {}) },
            _sum: { refundAmount: true, profitAdjustment: true },
            _count: { id: true },
          }),
          prisma.expense.aggregate({
            where: { status: 'ACTIVE', ...(dateRange ? { expenseDate: dateRange } : {}) },
            _sum: { amount: true },
          }),
          prisma.expense.count({ where: expenseWhere }),
          prisma.expense.findMany({
            where: expenseWhere,
            orderBy: { expenseDate: 'desc' },
            ...(exportAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
            include: { category: { select: { name: true } } },
          }),
          prisma.supplier.aggregate({
            where: { status: 'ACTIVE' },
            _sum: { outstandingBalance: true },
          }),
        ]);

      const salesRevenue = salesAgg._sum.totalAmount ?? 0;
      const costOfGoodsSold = salesAgg._sum.totalCost ?? 0;
      const grossProfit = salesAgg._sum.grossProfit ?? 0;
      const returnAdjustments = returnsAgg._sum.profitAdjustment ?? 0;
      const totalExpenses = expensesAgg._sum.amount ?? 0;
      const netProfit = calculateNetProfit({
        grossSalesProfit: grossProfit,
        returnProfitAdjustments: returnAdjustments,
        totalExpenses,
      });

      return NextResponse.json({
        type: 'financial',
        summary: {
          salesCount: salesAgg._count.id,
          salesRevenue,
          costOfGoodsSold,
          grossProfit,
          returnCount: returnsAgg._count.id,
          returnRefunds: returnsAgg._sum.refundAmount ?? 0,
          returnAdjustments,
          totalExpenses,
          netProfit,
          supplierOutstanding: supplierAgg._sum.outstandingBalance ?? 0,
        },
        items: expenseItems,
        total: totalExpensesCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalExpensesCount / pageSize)),
      });
    }

    if (reportType === 'customers') {
      const where: Prisma.CustomerWhereInput = search
        ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : {};

      const [total, customers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          orderBy: { name: 'asc' },
          ...(exportAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
          select: { id: true, name: true, phone: true, address: true },
        }),
      ]);

      const customerIds = customers.map((c) => c.id);
      const salesStats =
        customerIds.length > 0
          ? await prisma.sale.groupBy({
              by: ['customerId'],
              where: {
                customerId: { in: customerIds },
                status: { not: 'CANCELLED' },
                ...(dateRange ? { saleDate: dateRange } : {}),
              },
              _count: { id: true },
              _sum: { totalAmount: true },
              _max: { saleDate: true },
            })
          : [];

      const statsMap = new Map(salesStats.map((s) => [s.customerId, s]));

      const items = customers.map((c) => {
        const stat = statsMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          invoiceCount: stat?._count.id ?? 0,
          totalSpent: stat?._sum.totalAmount ?? 0,
          lastPurchaseDate: stat?._max.saleDate ?? null,
        };
      });

      return NextResponse.json({
        type: 'customers',
        summary: {
          totalCustomers: total,
          totalSpent: items.reduce((s, c) => s + c.totalSpent, 0),
        },
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // Stock movements report
    const where: Prisma.StockMovementWhereInput = {
      ...(dateRange ? { createdAt: dateRange } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search } },
              { product: { name: { contains: search } } },
              { product: { sku: { contains: search } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(exportAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          product: { select: { name: true, sku: true } },
          serializedItem: { select: { serialNumber: true } },
        },
      }),
    ]);

    return NextResponse.json({
      type: 'movements',
      summary: { totalMovements: total },
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
