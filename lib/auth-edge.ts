import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'tayyab_admin_session';

export interface AdminSessionPayload {
  userId: string;
  username: string;
  displayName: string;
}

// Development-only fallback so `next dev` works without .env setup.
// Production (NODE_ENV=production, e.g. the packaged Electron app) REQUIRES
// AUTH_SECRET — Electron's main process always injects a generated one.
const DEV_FALLBACK_SECRET = 'tayyab-enterprises-dev-only-secret-not-for-production';
const MIN_SECRET_LENGTH = 32;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is missing or shorter than 32 characters. ' +
        'Set AUTH_SECRET to a random 64-char hex string before starting the server.'
    );
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

export async function signSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : 'Tayyab Admin',
    };
  } catch {
    return null;
  }
}
