import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { customerSchema } from '@/lib/validation/schemas';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { saleDate: 'desc' },
          include: {
            items: {
              include: {
                product: { select: { name: true, sku: true } },
                serializedItem: { select: { serialNumber: true } },
              },
            },
            warranties: { select: { id: true, warrantyEnd: true, status: true } },
          },
        },
        warranties: {
          orderBy: { warrantyEnd: 'desc' },
          include: {
            product: { select: { name: true } },
            serializedItem: { select: { serialNumber: true } },
            sale: { select: { invoiceNumber: true } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json(customer);
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
    const data = customerSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Customer not found.', 404);
      const cust = await tx.customer.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          address: data.address || null,
          notes: data.notes || null,
        },
      });
      await recordAuditLog(tx, {
        entityType: 'Customer',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: cust,
        adminUserId: auth.session.userId,
      });
      return cust;
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
      const existing = await tx.customer.findUnique({
        where: { id },
        include: { _count: { select: { sales: true } } },
      });
      if (!existing) throw new BusinessRuleError('Customer not found.', 404);
      if (existing._count.sales > 0) {
        throw new BusinessRuleError(
          `Cannot delete "${existing.name}" because they have ${existing._count.sales} invoice(s) on record.`
        );
      }
      await tx.customer.delete({ where: { id } });
      await recordAuditLog(tx, {
        entityType: 'Customer',
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
