import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation/schemas';
import { attachSessionCookie, verifyPassword } from '@/lib/auth';
import { ensureDatabaseSeeded } from '@/lib/database/seed';
import { handleApiError } from '@/lib/api-utils';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';

// Precomputed bcrypt hash of a random value. Used only to equalize response
// timing when the requested username does not exist. Never a valid credential.
const DUMMY_PASSWORD_HASH = '$2b$10$A6/L8Vu/r.SdwGuL1FZukO/06TWoMEs2QDQ8CLjHegzGw85hymZni';

// Brute-force guard: 5 attempts per 5 minutes per client.
const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(rateLimitKey(req, 'login'), LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    await ensureDatabaseSeeded();
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    // Always run a bcrypt comparison (against a dummy hash when the user does not
    // exist) so response timing does not reveal which usernames are valid.
    const admin = await prisma.adminUser.findUnique({
      where: { username: parsed.username },
    });

    const isValid = await verifyPassword(
      parsed.password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH
    );
    if (!admin || !isValid) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const response = NextResponse.json({
      user: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
      },
    });

    await attachSessionCookie(
      response,
      {
        userId: admin.id,
        username: admin.username,
        displayName: admin.displayName,
      },
      req
    );

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
