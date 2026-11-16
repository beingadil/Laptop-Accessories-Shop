import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { customerSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    if (url.searchParams.get('all') === '1') {
      const items = await prisma.customer.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true, address: true },
      });
      return NextResponse.json({ items });
    }

    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { address: { contains: search } },
          ],
        }
      : {};

    const orderField = ['name', 'phone', 'createdAt'].includes(sortBy) ? sortBy : 'createdAt';

    const [total, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { sales: { where: { status: { not: 'CANCELLED' } } } } },
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
    const data = customerSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: data.name,
          phone: data.phone,
          address: data.address || null,
          notes: data.notes || null,
        },
      });
      await recordAuditLog(tx, {
        entityType: 'Customer',
        entityId: customer.id,
        action: 'CREATE',
        updatedData: customer,
        adminUserId: auth.session.userId,
      });
      return customer;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
