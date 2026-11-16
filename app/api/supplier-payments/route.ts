import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError, parseDateParam } from '@/lib/api-utils';
import { supplierPaymentSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recalculateSupplierBalance } from '@/lib/services/purchases';
import { recordAuditLog } from '@/lib/services/audit';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    const { page, pageSize, search, sortOrder } = parsePaginationParams(url.searchParams);
    const supplierId = url.searchParams.get('supplierId') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    const where: Prisma.SupplierPaymentWhereInput = {
      status: 'COMPLETED',
      ...(supplierId ? { supplierId } : {}),
      ...(search
        ? {
            OR: [
              { referenceNumber: { contains: search } },
              { notes: { contains: search } },
              { supplier: { name: { contains: search } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            paymentDate: {
              ...(dateFrom ? { gte: parseDateParam(dateFrom, 'dateFrom') } : {}),
              ...(dateTo ? { lte: parseDateParam(dateTo, 'dateTo', true) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.supplierPayment.count({ where }),
      prisma.supplierPayment.findMany({
        where,
        orderBy: { paymentDate: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { id: true, name: true, phone: true, outstandingBalance: true } },
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
    const data = supplierPaymentSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) throw new BusinessRuleError('Selected supplier not found.', 404);

      const paymentDate = new Date(data.paymentDate);
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId: supplier.id,
          paymentDate,
          amount: data.amount,
          paymentMethod: 'CASH',
          referenceNumber: data.referenceNumber || null,
          notes: data.notes || null,
        },
      });

      await recalculateSupplierBalance(tx, supplier.id);
      await recordAuditLog(tx, {
        entityType: 'SupplierPayment',
        entityId: payment.id,
        action: 'CREATE',
        updatedData: payment,
        adminUserId: auth.session.userId,
      });

      return payment;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
