import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { expenseSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recordAuditLog } from '@/lib/services/audit';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const categoryId = url.searchParams.get('categoryId') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    const where: Prisma.ExpenseWhereInput = {
      status: 'ACTIVE',
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { category: { name: { contains: search } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            expenseDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const orderField = ['title', 'amount', 'expenseDate', 'createdAt'].includes(sortBy)
      ? sortBy
      : 'expenseDate';

    const [total, items, sumAgg] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return NextResponse.json({
      items,
      total,
      totalAmount: sumAgg._sum.amount ?? 0,
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
    const data = expenseSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title: data.title,
          categoryId: data.categoryId,
          amount: data.amount,
          expenseDate: new Date(data.expenseDate),
          description: data.description || null,
          notes: data.notes || null,
        },
        include: { category: { select: { id: true, name: true } } },
      });
      await recordAuditLog(tx, {
        entityType: 'Expense',
        entityId: expense.id,
        action: 'CREATE',
        updatedData: expense,
        adminUserId: auth.session.userId,
      });
      return expense;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
