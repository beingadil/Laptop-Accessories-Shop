import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { parsePaginationParams } from '@/lib/format';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const tab = url.searchParams.get('tab') || 'serialized';
    const { page, pageSize, search, sortOrder } = parsePaginationParams(url.searchParams);

    if (tab === 'serialized') {
      const stockStatus = url.searchParams.get('stockStatus') || '';
      const productId = url.searchParams.get('productId') || '';

      const where: Prisma.SerializedInventoryItemWhereInput = {
        ...(search
          ? {
              OR: [
                { serialNumber: { contains: search } },
                { product: { name: { contains: search } } },
                { product: { sku: { contains: search } } },
                { product: { model: { contains: search } } },
              ],
            }
          : {}),
        ...(stockStatus ? { stockStatus: stockStatus as Prisma.EnumSerializedStockStatusFilter['equals'] } : {}),
        ...(productId ? { productId } : {}),
      };

      const [total, items] = await Promise.all([
        prisma.serializedInventoryItem.count({ where }),
        prisma.serializedInventoryItem.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                brand: true,
                model: true,
                processor: true,
                ram: true,
                ssd: true,
                category: { select: { name: true } },
              },
            },
            purchase: { select: { id: true, purchaseNumber: true } },
          },
        }),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // Quantity inventory or alerts
    const alertFilter = url.searchParams.get('alert') || '';
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(tab === 'quantity' ? { inventoryType: 'QUANTITY' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
              { brand: { contains: search } },
            ],
          }
        : {}),
      ...(alertFilter === 'OUT_OF_STOCK' ? { currentStock: 0 } : {}),
    };

    if (alertFilter === 'LOW_STOCK') {
      const all = await prisma.product.findMany({
        where,
        orderBy: { currentStock: 'asc' },
        include: { category: { select: { id: true, name: true } } },
      });
      const low = all.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
      const total = low.length;
      return NextResponse.json({
        items: low.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { currentStock: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { id: true, name: true } } },
      }),
    ]);

    return NextResponse.json({
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
