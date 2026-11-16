import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { AdminSessionPayload } from '@/lib/auth';
import { getSession } from '@/lib/auth';

export class BusinessRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessRuleError';
    this.status = status;
  }
}

/**
 * @deprecated Stateless JWTs mean there is no server-side session cache to
 * invalidate. Kept as a no-op so existing call sites don't break.
 */
export function invalidateSessionCache() {
  // no-op by design (stateless sessions)
}

export async function requireAuth(): Promise<
  | { session: AdminSessionPayload; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      ),
    };
  }
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
