import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { saleSchema } from '@/lib/validation/schemas';
import { deleteSale, updateSale } from '@/lib/services/sales';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    const [sale, settings] = await Promise.all([
      prisma.sale.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  brand: true,
                  model: true,
                  processor: true,
                  ram: true,
                  ssd: true,
                  inventoryType: true,
                },
              },
              serializedItem: { select: { id: true, serialNumber: true, condition: true } },
            },
          },
          warranties: true,
          returns: {
            include: {
              items: { include: { product: { select: { name: true } } } },
              replacementItems: { include: { product: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.shopSettings.findUnique({ where: { id: 'default' } }),
    ]);

    if (!sale) return NextResponse.json({ error: 'Sale invoice not found.' }, { status: 404 });
    return NextResponse.json({ sale, settings });
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
    const data = saleSchema.parse(body);

    const updated = await updateSale(id, data, auth.session.userId);
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

    await deleteSale(id, auth.session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
