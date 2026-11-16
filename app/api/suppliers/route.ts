import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { supplierSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    if (url.searchParams.get('all') === '1') {
      const items = await prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true, outstandingBalance: true },
      });
      return NextResponse.json({ items });
    }

    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const status = url.searchParams.get('status') || '';

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { address: { contains: search } },
            ],
          }
        : {}),
      ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status: status as 'ACTIVE' | 'INACTIVE' } : {}),
    };

    const orderField = ['name', 'outstandingBalance', 'createdAt'].includes(sortBy) ? sortBy : 'createdAt';

    const [total, items] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              purchases: { where: { status: 'COMPLETED' } },
              payments: { where: { status: 'COMPLETED' } },
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
    const data = supplierSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          name: data.name,
          phone: data.phone,
          address: data.address || null,
          notes: data.notes || null,
          openingBalance: data.openingBalance,
          outstandingBalance: data.openingBalance,
          status: data.status,
        },
      });
      await recordAuditLog(tx, {
        entityType: 'Supplier',
        entityId: supplier.id,
        action: 'CREATE',
        updatedData: supplier,
        adminUserId: auth.session.userId,
      });
      return supplier;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
