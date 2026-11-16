import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookieOnResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  return clearSessionCookieOnResponse(res, req);
}
