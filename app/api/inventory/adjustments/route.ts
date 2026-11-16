import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { stockAdjustmentSchema } from '@/lib/validation/schemas';
import { recordStockAdjustment } from '@/lib/services/inventory';
import { parsePaginationParams } from '@/lib/format';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { page, pageSize, search } = parsePaginationParams(req.nextUrl.searchParams);
    const where = {
      movementType: { in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'LOST'] as ('ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGED' | 'LOST')[] },
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
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, name: true, sku: true, inventoryType: true } },
          serializedItem: { select: { serialNumber: true } },
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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const data = stockAdjustmentSchema.parse(body);
    const result = await recordStockAdjustment(data, auth.session.userId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
