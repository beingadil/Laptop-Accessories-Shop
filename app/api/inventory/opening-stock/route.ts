import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { openingStockSchema } from '@/lib/validation/schemas';
import { recordOpeningStock } from '@/lib/services/inventory';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const data = openingStockSchema.parse(body);
    const result = await recordOpeningStock(data, auth.session.userId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
