import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { purchaseSchema } from '@/lib/validation/schemas';
import { deletePurchase, updatePurchase } from '@/lib/services/purchases';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, inventoryType: true, sellingPrice: true } },
          },
        },
        serializedItems: {
          select: {
            id: true,
            productId: true,
            serialNumber: true,
            purchasePrice: true,
            sellingPrice: true,
            condition: true,
            stockStatus: true,
          },
        },
      },
    });

    if (!purchase) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
    return NextResponse.json(purchase);
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
    const data = purchaseSchema.parse(body);

    const updated = await updatePurchase(id, data, auth.session.userId);
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

    await deletePurchase(id, auth.session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
