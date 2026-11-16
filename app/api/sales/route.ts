import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, parseDateParam, parseEnumParam } from '@/lib/api-utils';
import { saleSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { createSale } from '@/lib/services/sales';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const customerId = url.searchParams.get('customerId') || '';
    const status =
      parseEnumParam(
        url.searchParams.get('status') || '',
        ['COMPLETED', 'PARTIAL_RETURN', 'RETURNED', 'CANCELLED'] as const,
        'status'
      ) ?? '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const includeCancelled = url.searchParams.get('includeCancelled') === '1';

    const where: Prisma.SaleWhereInput = {
      ...(!includeCancelled && !status ? { status: { not: 'CANCELLED' } } : {}),
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { walkInCustomerName: { contains: search } },
              { walkInCustomerPhone: { contains: search } },
              { customer: { name: { contains: search } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            saleDate: {
              ...(dateFrom ? { gte: parseDateParam(dateFrom, 'dateFrom') } : {}),
              ...(dateTo ? { lte: parseDateParam(dateTo, 'dateTo', true) } : {}),
            },
          }
        : {}),
    };

    const orderField = ['invoiceNumber', 'saleDate', 'totalAmount', 'grossProfit', 'createdAt'].includes(sortBy)
      ? sortBy
      : 'saleDate';

    const [total, items] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
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
    const data = saleSchema.parse(body);
    const sale = await createSale(data, auth.session.userId);

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
