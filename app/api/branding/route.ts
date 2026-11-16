import { NextResponse } from 'next/server';
import { getShopBranding } from '@/lib/services/branding';

export const dynamic = 'force-dynamic';

export async function GET() {
  const branding = await getShopBranding();
  return NextResponse.json(branding, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
