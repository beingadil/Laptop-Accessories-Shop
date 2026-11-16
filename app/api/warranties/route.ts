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
    const statusFilter = url.searchParams.get('status') || '';
    const now = new Date();

    const where: Prisma.WarrantyWhereInput = {
      ...(search
        ? {
            OR: [
              { sale: { invoiceNumber: { contains: search } } },
              { customer: { name: { contains: search } } },
              { customer: { phone: { contains: search } } },
              { product: { name: { contains: search } } },
              { serializedItem: { serialNumber: { contains: search } } },
            ],
          }
        : {}),
      ...(statusFilter === 'ACTIVE'
        ? { status: { not: 'VOID' }, warrantyEnd: { gte: now } }
        : statusFilter === 'EXPIRED'
        ? { status: { not: 'VOID' }, warrantyEnd: { lt: now } }
        : statusFilter === 'VOID'
        ? { status: 'VOID' }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.warranty.count({ where }),
      prisma.warranty.findMany({
        where,
        orderBy: { warrantyEnd: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sale: { select: { id: true, invoiceNumber: true, walkInCustomerName: true, walkInCustomerPhone: true } },
          customer: { select: { id: true, name: true, phone: true } },
          product: { select: { id: true, name: true, sku: true } },
          serializedItem: { select: { id: true, serialNumber: true } },
        },
      }),
    ]);

    const enriched = items.map((w) => ({
      ...w,
      computedStatus: w.status === 'VOID' ? 'VOID' : w.warrantyEnd >= now ? 'ACTIVE' : 'EXPIRED',
    }));

    return NextResponse.json({
      items: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
