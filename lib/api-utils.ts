import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import type { AdminSessionPayload } from '@/lib/auth';
import { ensureDatabaseSeeded } from '@/lib/database/seed';

export class BusinessRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessRuleError';
    this.status = status;
  }
}

const globalForSession = globalThis as unknown as {
  __tayyabAdminSession?: AdminSessionPayload;
};

export function invalidateSessionCache() {
  globalForSession.__tayyabAdminSession = undefined;
}

export async function requireAuth(): Promise<{
  session: AdminSessionPayload;
  errorResponse: null;
}> {
  await ensureDatabaseSeeded();

  if (globalForSession.__tayyabAdminSession) {
    return { session: globalForSession.__tayyabAdminSession, errorResponse: null };
  }

  const admin = await prisma.adminUser.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, displayName: true },
  });

  const session: AdminSessionPayload = {
    userId: admin?.id || 'admin',
    username: admin?.username || 'admin',
    displayName: admin?.displayName || 'Tayyab Admin',
  };

  globalForSession.__tayyabAdminSession = session;
  return { session, errorResponse: null };
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message || 'Validation failed',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 }
    );
  }

  if (error instanceof BusinessRuleError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.join(', ') || 'record';
      return NextResponse.json(
        { error: `A record with this ${target} already exists.` },
        { status: 409 }
      );
    }
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot complete operation because related records exist.' },
        { status: 400 }
      );
    }
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }
  }

  console.error('[API Error]', error);
  return NextResponse.json(
    { error: 'An unexpected server error occurred. Please try again.' },
    { status: 500 }
  );
}
