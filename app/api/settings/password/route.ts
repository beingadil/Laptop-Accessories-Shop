import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { attachSessionCookie, hashPassword, verifyPassword } from '@/lib/auth';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const limit = rateLimit(rateLimitKey(req, 'change-password'), 5, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const data = changePasswordSchema.parse(body);

    const admin = await prisma.adminUser.findUnique({ where: { id: auth.session.userId } });
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });
    }

    const valid = await verifyPassword(data.currentPassword, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const newHash = await hashPassword(data.newPassword);
    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash: newHash,
        ...(data.username ? { username: data.username } : {}),
      },
    });

    const response = NextResponse.json({ success: true, username: updated.username });
    await attachSessionCookie(
      response,
      {
        userId: updated.id,
        username: updated.username,
        displayName: updated.displayName,
      },
      req
    );

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
