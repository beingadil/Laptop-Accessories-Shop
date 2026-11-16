import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { slugifyShopName } from '@/lib/branding';
import { clearSessionCookieOnResponse } from '@/lib/auth';
import { resolveSqliteDbPath } from '@/lib/db-path';

// A backup larger than this is rejected (memory + disk exhaustion guard).
const MAX_BACKUP_BYTES = 250 * 1024 * 1024; // 250 MB

// Tables that MUST exist in a valid Tayyab Enterprises backup — a foreign or
// older-schema SQLite file fails here before we touch the live database.
const REQUIRED_TABLES = [
  'AdminUser',
  'ShopSettings',
  'ProductCategory',
  'Product',
  'SerializedInventoryItem',
  'StockMovement',
  'Customer',
  'Supplier',
  'Purchase',
  'PurchaseItem',
  'SupplierPayment',
  'Sale',
  'SaleItem',
  'ExpenseCategory',
  'Expense',
  'Return',
  'ReturnItem',
  'ExchangeReplacementItem',
  'Warranty',
  'AuditLog',
] as const;

// Spot-check the columns each app version relies on. Catches "valid SQLite
// from an older/incompatible build" far better than counting rows.
const REQUIRED_COLUMNS: Record<string, string[]> = {
  Product: ['id', 'name', 'sku', 'currentStock', 'purchasePrice', 'sellingPrice', 'inventoryType', 'status'],
  Sale: ['id', 'invoiceNumber', 'saleDate', 'totalAmount', 'status'],
  AdminUser: ['id', 'username', 'passwordHash'],
  ShopSettings: ['id', 'shopName'],
};

/** Open the uploaded file read-only with a throwaway client and validate its
 *  full schema + integrity. Never touches the live database. */
async function verifyBackupFile(dbPath: string): Promise<void> {
  const test = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const tables = await test.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const names = new Set(tables.map((t) => t.name));
    const missing = REQUIRED_TABLES.filter((t) => !names.has(t));
    if (missing.length) {
      throw new BusinessRuleError(
        `Not a Tayyab Enterprises backup (missing tables: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}).`
      );
    }

    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      const info = await test.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info(${table})`);
      const have = new Set(info.map((c) => c.name));
      const missingCols = cols.filter((c) => !have.has(c));
      if (missingCols.length) {
        throw new BusinessRuleError(
          `This backup's ${table} table is missing required column(s): ${missingCols.join(', ')}. It was created by an incompatible version of the app.`
        );
      }
    }

    const rows = await test.$queryRawUnsafe<Array<Record<string, string>>>('PRAGMA quick_check');
    const result = rows?.[0] ? String(Object.values(rows[0])[0]) : '';
    if (result.toLowerCase() !== 'ok') {
      throw new BusinessRuleError(`Backup failed its integrity check (${result || 'unknown failure'}).`);
    }
  } finally {
    await test.$disconnect().catch(() => {});
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // Checkpoint WAL first so the backup file contains all committed data
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore if not in WAL mode
    }

    const dbPath = resolveSqliteDbPath();
    const settings = await prisma.shopSettings.findUnique({
      where: { id: 'default' },
      select: { shopName: true },
    });
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
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const suffix = crypto.randomBytes(8).toString('hex');
  const tempPath = path.join(dir, `.${base}.restore-upload-${suffix}.tmp`);
  const preRestoreCopy = path.join(dir, `${base}.pre-restore.bak`);

  // Track whether the live file was swapped, so the catch-all knows how to
  // roll back. The swap is the only destructive step.
  let swapped = false;

  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // Reject oversized uploads BEFORE buffering the body
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BACKUP_BYTES * 2) {
      return NextResponse.json(
        { error: 'Upload is too large. Maximum supported size is 250 MB.' },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('backupFile');
    const confirmed = formData.get('confirmed') === 'true';

    if (!confirmed) {
      throw new BusinessRuleError(
        'Restore confirmation is required before overwriting existing data.'
      );
    }

    if (!file || !(file instanceof File)) {
      throw new BusinessRuleError('Please select a valid SQLite (.db) backup file.');
    }

    if (file.size > MAX_BACKUP_BYTES) {
      throw new BusinessRuleError(
        `Backup file is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum supported size is 250 MB.`,
        413
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate SQLite magic header ("SQLite format 3" + NUL byte)
    const isSqliteMagic =
      buffer.length > 100 &&
      buffer.subarray(0, 15).toString('latin1') === 'SQLite format 3' &&
      buffer[15] === 0;
    if (!isSqliteMagic) {
      throw new BusinessRuleError(
        'Invalid backup file. Selected file is not a valid SQLite database.'
      );
    }

    // Stage the upload next to the live DB (same volume → atomic rename later)
    await fs.writeFile(tempPath, buffer);

    // Full schema + integrity verification of the uploaded file (read-only).
    // Any failure here leaves the live database untouched.
    try {
      await verifyBackupFile(tempPath);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => {});
      throw err;
    }

    // Checkpoint the WAL and VERIFY it was complete. Busy means someone else
    // holds the DB — abort before touching anything.
    const checkpoint = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(
      'PRAGMA wal_checkpoint(TRUNCATE);'
    );
    const busy = checkpoint?.[0] ? Number(Object.values(checkpoint[0])[0]) : 0;
    if (busy !== 0) {
      await fs.unlink(tempPath).catch(() => {});
      throw new BusinessRuleError(
        'The database is busy with another operation. Please try the restore again in a moment.',
        409
      );
    }

    // Snapshot a consistent copy of the live DB (includes WAL contents).
    // Abort entirely if this fails — we never swap without a rollback file.
    try {
      await fs.rm(preRestoreCopy, { force: true });
      await prisma.$queryRawUnsafe(`VACUUM INTO '${preRestoreCopy.replace(/'/g, "''")}'`);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => {});
      throw new BusinessRuleError(
        `Could not snapshot the current database before restore (${err instanceof Error ? err.message : 'unknown error'}). No changes were made.`,
        500
      );
    }

    // Atomic swap: disconnect, drop sidecars, rename temp over live file
    await prisma.$disconnect();
    await fs.rm(`${dbPath}-wal`, { force: true });
    await fs.rm(`${dbPath}-shm`, { force: true });
    await fs.rename(tempPath, dbPath);
    swapped = true;

    // Reconnect and verify the NEW database. Any failure → restore the
    // pre-restore snapshot automatically.
    let verifyError: string | null = null;
    try {
      await prisma.$connect();
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>('PRAGMA quick_check');
      const result = rows?.[0] ? String(Object.values(rows[0])[0]) : '';
      if (result.toLowerCase() !== 'ok') {
        verifyError = `integrity check: ${result || 'unknown failure'}`;
      } else {
        await prisma.shopSettings.count();
        await prisma.product.count();
      }
    } catch (err) {
      verifyError = err instanceof Error ? err.message : 'unknown failure';
    }

    if (verifyError) {
      try {
        await prisma.$disconnect();
      } catch {
        // best effort
      }
      try {
        await fs.rm(`${dbPath}-wal`, { force: true });
        await fs.rm(`${dbPath}-shm`, { force: true });
        await fs.rename(preRestoreCopy, dbPath);
      } catch {
        // If rollback fails too, leave .pre-restore.bak in place for manual recovery
      }
      await prisma.$connect().catch(() => {});
      throw new BusinessRuleError(
        `Restore failed after replacing the database (${verifyError}). Your previous database was restored automatically.`,
        400
      );
    }

    const { resetSeedCache } = await import('@/lib/database/seed');
    resetSeedCache();

    // Sign the admin out of the (possibly different) restored database — the
    // restored AdminUser may not match any cookie of this installation.
    const response = NextResponse.json({
      success: true,
      message: 'Database restored successfully. Please sign in again.',
    });
    return clearSessionCookieOnResponse(response, req);
  } catch (error) {
    if (!swapped) {
      // Live DB never touched — clean up the staged upload if it exists
      await fs.unlink(tempPath).catch(() => {});
    }
    return handleApiError(error);
  }
}
