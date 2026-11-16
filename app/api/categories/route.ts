import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { categorySchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    if (url.searchParams.get('all') === '1') {
      const items = await prisma.productCategory.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      });
      return NextResponse.json({ items });
    }

    const { page, pageSize, search, sortOrder } = parsePaginationParams(url.searchParams);
    const status = url.searchParams.get('status') || '';

    const where = {
      ...(search
        ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
        : {}),
      ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status: status as 'ACTIVE' | 'INACTIVE' } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.productCategory.count({ where }),
      prisma.productCategory.findMany({
        where,
        orderBy: { name: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { products: true } } },
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
    const data = categorySchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const cat = await tx.productCategory.create({ data });
      await recordAuditLog(tx, {
        entityType: 'ProductCategory',
        entityId: cat.id,
        action: 'CREATE',
        updatedData: cat,
        adminUserId: auth.session.userId,
      });
      return cat;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
