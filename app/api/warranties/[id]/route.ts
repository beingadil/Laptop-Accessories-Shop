import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { recordAuditLog } from '@/lib/services/audit';
import { z } from 'zod';

const updateWarrantySchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'VOID']).optional(),
  warrantyTerms: z.string().trim().max(800).optional(),
  durationMonths: z.coerce.number().int().min(0).max(60).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const body = await req.json();
    const data = updateWarrantySchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.warranty.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Warranty record not found.', 404);

      let warrantyEnd = existing.warrantyEnd;
      if (data.durationMonths !== undefined) {
        warrantyEnd = new Date(existing.warrantyStart);
        warrantyEnd.setMonth(warrantyEnd.getMonth() + data.durationMonths);
      }

      const w = await tx.warranty.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.warrantyTerms !== undefined ? { warrantyTerms: data.warrantyTerms } : {}),
          ...(data.durationMonths !== undefined ? { durationMonths: data.durationMonths, warrantyEnd } : {}),
        },
      });

      await recordAuditLog(tx, {
        entityType: 'Warranty',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: w,
        adminUserId: auth.session.userId,
      });

      return w;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
