import { NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { getDashboardData } from '@/lib/services/reports';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
