import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { supplierPaymentSchema } from '@/lib/validation/schemas';
import { recalculateSupplierBalance } from '@/lib/services/purchases';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    const payment = await prisma.supplierPayment.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, name: true, outstandingBalance: true } } },
    });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json(payment);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const body = await req.json();
    const data = supplierPaymentSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplierPayment.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Payment not found.', 404);

      const oldSupplierId = existing.supplierId;
      const payment = await tx.supplierPayment.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          paymentDate: new Date(data.paymentDate),
          amount: data.amount,
          referenceNumber: data.referenceNumber || null,
          notes: data.notes || null,
        },
      });

      await recalculateSupplierBalance(tx, oldSupplierId);
      if (oldSupplierId !== data.supplierId) {
        await recalculateSupplierBalance(tx, data.supplierId);
      }

      await recordAuditLog(tx, {
        entityType: 'SupplierPayment',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: payment,
        adminUserId: auth.session.userId,
      });

      return payment;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.supplierPayment.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Payment not found.', 404);

      await tx.supplierPayment.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await recalculateSupplierBalance(tx, existing.supplierId);
      await recordAuditLog(tx, {
        entityType: 'SupplierPayment',
        entityId: id,
        action: 'DELETE',
        previousData: existing,
        updatedData: { status: 'CANCELLED' },
        adminUserId: auth.session.userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
