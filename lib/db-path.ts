import path from 'node:path';

/**
 * Absolute path to the SQLite file named by DATABASE_URL, resolved EXACTLY the
 * same way everywhere (lib/prisma.ts, app/api/backup/route.ts). Mismatched
 * resolution previously meant backup/restore could operate on a different
 * file than the app was using.
 */
export function resolveSqliteDbPath(): string {
  const configured = process.env.DATABASE_URL?.trim();
  const dbUrl = configured && configured.length > 0 ? configured : 'file:./dev.db';
  const rawPath = dbUrl.replace(/^file:/, '');
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  if (rawPath.startsWith('./prisma/') || rawPath.startsWith('prisma/')) {
    return path.resolve(process.cwd(), rawPath);
  }
  return path.resolve(process.cwd(), 'prisma', rawPath);
}
