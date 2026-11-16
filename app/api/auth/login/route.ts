import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation/schemas';
import { attachSessionCookie, verifyPassword } from '@/lib/auth';
import { ensureDatabaseSeeded } from '@/lib/database/seed';
import { handleApiError } from '@/lib/api-utils';

// Precomputed bcrypt hash of a random value. Used only to equalize response
// timing when the requested username does not exist. Never a valid credential.
const DUMMY_PASSWORD_HASH = '$2b$10$A6/L8Vu/r.SdwGuL1FZukO/06TWoMEs2QDQ8CLjHegzGw85hymZni';

export async function POST(req: NextRequest) {
  try {
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
