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
    const { page, pageSize, search } = parsePaginationParams(url.searchParams);
    const movementType = url.searchParams.get('movementType') || '';
    const productId = url.searchParams.get('productId') || '';

    const where: Prisma.StockMovementWhereInput = {
      ...(search
        ? {
            OR: [
              { reason: { contains: search } },
              { product: { name: { contains: search } } },
              { product: { sku: { contains: search } } },
              { serializedItem: { serialNumber: { contains: search } } },
            ],
          }
        : {}),
      ...(movementType
        ? { movementType: movementType as Prisma.EnumStockMovementTypeFilter['equals'] }
        : {}),
      ...(productId ? { productId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, name: true, sku: true, inventoryType: true } },
          serializedItem: { select: { id: true, serialNumber: true } },
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
  } catch (error) {
    return handleApiError(error);
  }
}
