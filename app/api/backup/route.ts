import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { slugifyShopName } from '@/lib/branding';

// A backup larger than this is rejected outright (memory + disk exhaustion guard).
const MAX_BACKUP_BYTES = 250 * 1024 * 1024; // 250 MB

// Tables that every Tayyab Enterprises database must contain. Their presence in
// the backup's sqlite_master text is a cheap structural sanity check — it rejects
// "a valid SQLite file that is not this app's database".
const REQUIRED_TABLE_MARKERS = [
  'Product',
  'Sale',
  'ShopSettings',
  'AdminUser',
  'StockMovement',
];

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
  const dbPath = resolveSqliteDbPath();
  const preRestoreCopy = `${dbPath}.pre-restore.bak`;
  let tookPreRestoreCopy = false;

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

    if (file.size > MAX_BACKUP_BYTES) {
      throw new BusinessRuleError(
        `Backup file is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum supported size is ${MAX_BACKUP_BYTES / 1024 / 1024} MB.`,
        413
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate SQLite file magic header ("SQLite format 3" + NUL byte)
    const isSqliteMagic =
      buffer.length > 16 &&
      buffer.subarray(0, 15).toString('latin1') === 'SQLite format 3' &&
      buffer[15] === 0;
    if (!isSqliteMagic) {
      throw new BusinessRuleError(
        'Invalid backup file. Selected file is not a valid SQLite database.'
      );
    }

    // Structural sanity check: the sqlite_master text (early pages of the file)
    // must mention this app's core tables. Rejects valid-but-foreign databases.
    const headText = buffer.subarray(0, Math.min(buffer.length, 512 * 1024)).toString('latin1');
    const missing = REQUIRED_TABLE_MARKERS.filter((marker) => !headText.includes(marker));
    if (missing.length > 0) {
      throw new BusinessRuleError(
        'This SQLite file is not a Tayyab Enterprises backup (missing required tables). Restore aborted.'
      );
    }

    // Checkpoint current WAL so the pre-restore snapshot is complete, then back it up.
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore if not in WAL mode
    }
    try {
      await fs.copyFile(dbPath, preRestoreCopy);
      tookPreRestoreCopy = true;
    } catch {
      // No prior file — nothing to snapshot
    }

    await prisma.$disconnect();

    // Remove stale WAL/SHM sidecar files before replacing main DB
    await fs.rm(`${dbPath}-wal`, { force: true });
    await fs.rm(`${dbPath}-shm`, { force: true });
    await fs.writeFile(dbPath, buffer);

    // Reconnect and run a real integrity check on the restored file.
    // On ANY failure, roll back to the pre-restore snapshot.
    let integrityError: string | null = null;
    try {
      await prisma.$connect();
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>('PRAGMA quick_check;');
      const result = rows?.[0] ? String(Object.values(rows[0])[0]) : '';
      if (result.toLowerCase() !== 'ok') {
        integrityError = `quick_check reported: ${result || 'unknown failure'}`;
      } else {
        // Smoke test application-critical tables
        await prisma.shopSettings.count();
        await prisma.product.count();
      }
    } catch (err) {
      integrityError = err instanceof Error ? err.message : 'unknown integrity failure';
    }

    if (integrityError) {
      // Roll back to the snapshot
      try {
        await prisma.$disconnect();
      } catch {
        // best effort
      }
      if (tookPreRestoreCopy) {
        await fs.copyFile(preRestoreCopy, dbPath);
        await prisma.$connect().catch(() => {});
      }
      throw new BusinessRuleError(
        `Restored file failed integrity check (${integrityError}). The previous database was restored automatically.`,
        400
      );
    }

    const { resetSeedCache } = await import('@/lib/database/seed');
    resetSeedCache();

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully. Please refresh the application.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
