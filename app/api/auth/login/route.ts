import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation/schemas';
import { attachSessionCookie, verifyPassword } from '@/lib/auth';
import { ensureDatabaseSeeded } from '@/lib/database/seed';
import { handleApiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSeeded();
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    const admin = await prisma.adminUser.findUnique({
      where: { username: parsed.username },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const isValid = await verifyPassword(parsed.password, admin.passwordHash);
    if (!isValid) {
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
