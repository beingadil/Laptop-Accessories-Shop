/**
 * Minimal in-memory fixed-window rate limiter for a single-machine app.
 * State lives in the server process (Electron-spawned Next server) and resets
 * on restart — appropriate for one admin on one PC. Not distributed state.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (0 when allowed) */
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client key: forwarded IP if present, else a constant (local desktop). */
export function rateLimitKey(req: Request, scope: string): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${fwd || 'local'}`;
}
