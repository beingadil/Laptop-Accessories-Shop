import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { supplierSchema } from '@/lib/validation/schemas';
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

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          where: { status: 'COMPLETED' },
          orderBy: { purchaseDate: 'desc' },
          include: {
            items: { include: { product: { select: { name: true, sku: true } } } },
          },
        },
        payments: {
          where: { status: 'COMPLETED' },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
    }

    // Build chronological supplier ledger
    const ledgerEntries: Array<{
      id: string;
      date: Date;
      type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
      reference: string;
      debit: number;
      credit: number;
      runningBalance: number;
      notes: string | null;
    }> = [];

    const chronologicalEvents: Array<{
      id: string;
      date: Date;
      type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
      reference: string;
      debit: number;
      credit: number;
      notes: string | null;
    }> = [];

    if (supplier.openingBalance > 0) {
      chronologicalEvents.push({
        id: 'opening',
        date: supplier.createdAt,
        type: 'OPENING',
        reference: 'Opening Balance',
        debit: supplier.openingBalance,
        credit: 0,
        notes: 'Initial supplier balance',
      });
    }

    for (const p of supplier.purchases) {
      chronologicalEvents.push({
        id: p.id,
        date: p.purchaseDate,
        type: 'PURCHASE',
        reference: p.purchaseNumber,
        debit: p.totalAmount,
        credit: p.paidAmount,
        notes: p.notes,
      });
    }

    for (const pay of supplier.payments) {
      chronologicalEvents.push({
        id: pay.id,
        date: pay.paymentDate,
        type: 'PAYMENT',
        reference: pay.referenceNumber || 'Cash Payment',
        debit: 0,
        credit: pay.amount,
        notes: pay.notes,
      });
    }

    chronologicalEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    for (const ev of chronologicalEvents) {
      running = Math.max(0, running + ev.debit - ev.credit);
      ledgerEntries.push({ ...ev, runningBalance: running });
    }

    return NextResponse.json({
      ...supplier,
      ledger: ledgerEntries.reverse(),
    });
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
    const data = supplierSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Supplier not found.', 404);

      await tx.supplier.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          address: data.address || null,
          notes: data.notes || null,
          openingBalance: data.openingBalance,
          status: data.status,
        },
      });

      await recalculateSupplierBalance(tx, id);
      const refreshed = await tx.supplier.findUnique({ where: { id } });

      await recordAuditLog(tx, {
        entityType: 'Supplier',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: refreshed,
        adminUserId: auth.session.userId,
      });

      return refreshed;
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
      const existing = await tx.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              purchases: { where: { status: 'COMPLETED' } },
              payments: { where: { status: 'COMPLETED' } },
            },
          },
        },
      });
      if (!existing) throw new BusinessRuleError('Supplier not found.', 404);
      if (existing._count.purchases > 0 || existing._count.payments > 0) {
        throw new BusinessRuleError(
          `Cannot delete "${existing.name}" because they have purchase or payment history. Mark them Inactive instead.`
        );
      }
      await tx.supplier.delete({ where: { id } });
      await recordAuditLog(tx, {
        entityType: 'Supplier',
        entityId: id,
        action: 'DELETE',
        previousData: existing,
        adminUserId: auth.session.userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
