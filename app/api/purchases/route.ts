import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { purchaseSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { createPurchase } from '@/lib/services/purchases';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const supplierId = url.searchParams.get('supplierId') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const status = url.searchParams.get('status') || 'COMPLETED';

    const where: Prisma.PurchaseWhereInput = {
      ...(status !== 'ALL' ? { status: status as 'COMPLETED' | 'CANCELLED' } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(search
        ? {
            OR: [
              { purchaseNumber: { contains: search } },
              { supplier: { name: { contains: search } } },
              { notes: { contains: search } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            purchaseDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const orderField = ['purchaseNumber', 'purchaseDate', 'totalAmount', 'createdAt'].includes(sortBy)
      ? sortBy
      : 'purchaseDate';

    const [total, items] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true } },
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
    const data = purchaseSchema.parse(body);
    const purchase = await createPurchase(data, auth.session.userId);

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
