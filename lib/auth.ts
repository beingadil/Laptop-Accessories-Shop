import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type AdminSessionPayload,
} from '@/lib/auth-edge';

export type { AdminSessionPayload };
export { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken };

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function getSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function isHttpsContext(req?: NextRequest): boolean {
  if (req) {
    const fwdProto = req.headers.get('x-forwarded-proto');
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    if (
      fwdProto?.includes('https') ||
      req.nextUrl.protocol === 'https:' ||
      origin?.startsWith('https://') ||
      referer?.startsWith('https://')
    ) {
      return true;
    }
    return false;
  }
  return Boolean(process.env.APP_URL?.startsWith('https://'));
}

export function getCookieOptions(httpsContext: boolean, maxAgeSeconds: number) {
  if (httpsContext) {
    return {
      httpOnly: true,
      sameSite: 'none' as const,
      secure: true,
      partitioned: true,
      path: '/',
      maxAge: maxAgeSeconds,
    };
  }
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function attachSessionCookie(
  res: NextResponse,
  payload: AdminSessionPayload,
  req?: NextRequest
): Promise<NextResponse> {
  const token = await signSessionToken(payload);
  const httpsContext = isHttpsContext(req);
  res.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions(httpsContext, 60 * 60 * 24 * 7));
  return res;
}

export function clearSessionCookieOnResponse(
  res: NextResponse,
  req?: NextRequest
): NextResponse {
  const httpsContext = isHttpsContext(req);
  res.cookies.set(SESSION_COOKIE_NAME, '', getCookieOptions(httpsContext, 0));
  return res;
}

export async function setSessionCookie(payload: AdminSessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  const hdrs = await headers();
  const fwdProto = hdrs.get('x-forwarded-proto');
  const origin = hdrs.get('origin');
  const referer = hdrs.get('referer');
  const httpsContext = Boolean(
    fwdProto?.includes('https') ||
      origin?.startsWith('https://') ||
      referer?.startsWith('https://') ||
      process.env.APP_URL?.startsWith('https://')
  );
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(httpsContext, 60 * 60 * 24 * 7));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
