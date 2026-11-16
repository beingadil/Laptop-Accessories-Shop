import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { settingsSchema } from '@/lib/validation/schemas';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const [settings, admin] = await Promise.all([
      prisma.shopSettings.findUnique({ where: { id: 'default' } }),
      prisma.adminUser.findUnique({
        where: { id: auth.session.userId },
        select: { id: true, username: true, displayName: true },
      }),
    ]);

    return NextResponse.json({ settings, admin });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const data = settingsSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const prev = await tx.shopSettings.findUnique({ where: { id: 'default' } });
      const nextLogoDataUrl =
        data.logoDataUrl === undefined ? (prev?.logoDataUrl ?? null) : data.logoDataUrl;

      const next = await tx.shopSettings.upsert({
        where: { id: 'default' },
        update: {
          ...data,
          phone2: data.phone2 || '',
          logoDataUrl: nextLogoDataUrl,
        },
        create: {
          id: 'default',
          ...data,
          phone2: data.phone2 || '',
          logoDataUrl: data.logoDataUrl || null,
        },
      });

      await recordAuditLog(tx, {
        entityType: 'ShopSettings',
        entityId: 'default',
        action: 'UPDATE',
        previousData: { shopName: prev?.shopName, address: prev?.address },
        updatedData: { shopName: next.shopName, address: next.address },
        adminUserId: auth.session.userId,
      });

      return next;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
