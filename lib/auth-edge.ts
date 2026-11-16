import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'tayyab_admin_session';

export interface AdminSessionPayload {
  userId: string;
  username: string;
  displayName: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'tayyab-enterprises-local-desktop-secret-key-2026';
  return new TextEncoder().encode(secret);
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
