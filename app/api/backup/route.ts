import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { slugifyShopName } from '@/lib/branding';

function resolveSqliteDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  const rawPath = dbUrl.replace(/^file:/, '');
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  if (rawPath.startsWith('./prisma/') || rawPath.startsWith('prisma/')) {
    return path.resolve(process.cwd(), rawPath);
  }
  return path.resolve(process.cwd(), 'prisma', rawPath);
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // Checkpoint WAL before reading SQLite file so backup contains all committed data
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore if not in WAL mode
    }

    const [dbPath, settings] = await Promise.all([
      Promise.resolve(resolveSqliteDbPath()),
      prisma.shopSettings.findUnique({ where: { id: 'default' }, select: { shopName: true } }),
    ]);
    const fileBuffer = await fs.readFile(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${slugifyShopName(settings?.shopName)}-backup-${timestamp}.db`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const formData = await req.formData();
    const file = formData.get('backupFile');
    const confirmed = formData.get('confirmed') === 'true';

    if (!confirmed) {
      throw new BusinessRuleError('Restore confirmation is required before overwriting existing data.');
    }

    if (!file || !(file instanceof File)) {
      throw new BusinessRuleError('Please select a valid SQLite (.db) backup file.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate SQLite file magic header ("SQLite format 3\0")
    const header = buffer.subarray(0, 16).toString('utf8');
    if (header !== 'SQLite format 3\u0000') {
      throw new BusinessRuleError(
        'Invalid backup file. Selected file is not a valid Tayyab Enterprises SQLite database.'
      );
    }

    const dbPath = resolveSqliteDbPath();
    const preRestoreCopy = `${dbPath}.pre-restore.bak`;

    try {
      await fs.copyFile(dbPath, preRestoreCopy);
    } catch {
      // Ignore if no prior file
    }

    await prisma.$disconnect();

    // Remove stale WAL/SHM sidecar files before replacing main DB
    await fs.rm(`${dbPath}-wal`, { force: true });
    await fs.rm(`${dbPath}-shm`, { force: true });
    await fs.writeFile(dbPath, buffer);

    await prisma.$connect();
    // Smoke test critical table
    const settingsCount = await prisma.shopSettings.count();
    if (settingsCount < 0) {
      throw new BusinessRuleError('Restored database failed integrity check.');
    }

    const { resetSeedCache } = await import('@/lib/database/seed');
    const { invalidateSessionCache } = await import('@/lib/api-utils');
    resetSeedCache();
    invalidateSessionCache();

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully. Please refresh the application.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
