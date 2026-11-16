import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, parseDateParam } from '@/lib/api-utils';
import { exchangeSchema, returnSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { createExchange, createReturn } from '@/lib/services/returns';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const { page, pageSize, search } = parsePaginationParams(url.searchParams);
    const type = url.searchParams.get('type') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    const where: Prisma.ReturnWhereInput = {
      ...(type === 'RETURN' || type === 'EXCHANGE' ? { type } : {}),
      ...(search
        ? {
            OR: [
              { returnNumber: { contains: search } },
              { originalSale: { invoiceNumber: { contains: search } } },
              { customer: { name: { contains: search } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            returnDate: {
              ...(dateFrom ? { gte: parseDateParam(dateFrom, 'dateFrom') } : {}),
              ...(dateTo ? { lte: parseDateParam(dateTo, 'dateTo', true) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.return.count({ where }),
      prisma.return.findMany({
        where,
        orderBy: { returnDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          originalSale: { select: { id: true, invoiceNumber: true, walkInCustomerName: true } },
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              serializedItem: { select: { serialNumber: true } },
            },
          },
          replacementItems: {
            include: {
              product: { select: { name: true, sku: true } },
              serializedItem: { select: { serialNumber: true } },
            },
          },
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
    if (body?.mode === 'EXCHANGE') {
      const data = exchangeSchema.parse(body);
      const record = await createExchange(data, auth.session.userId);
      return NextResponse.json(record, { status: 201 });
    } else {
      const data = returnSchema.parse(body);
      const record = await createReturn(data, auth.session.userId);
      return NextResponse.json(record, { status: 201 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
