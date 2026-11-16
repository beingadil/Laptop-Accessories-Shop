import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-utils';

export async function GET() {
  const { session } = await requireAuth();
  return NextResponse.json({ authenticated: true, user: session }, { status: 200 });
}
