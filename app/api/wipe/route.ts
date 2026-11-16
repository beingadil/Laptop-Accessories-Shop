import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { resolveSqliteDbPath } from '@/lib/db-path';

/**
 * Destructive: permanently deletes every piece of business data.
 * Kept intentionally narrow: only records that represent shop activity are
 * removed. Reference/system data (admin user, shop settings, product
 * categories, expense categories) survives so the app remains usable.
 * A pre-wipe snapshot is taken first so recovery is possible.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'WIPE') {
      throw new BusinessRuleError('Type WIPE to confirm deletion.');
    }

    const dbPath = resolveSqliteDbPath();

    // Snapshot before touching anything
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore WAL-less setups
    }
    const preWipeCopy = `${dbPath}.pre-wipe.bak`;
    try {
      await fs.rm(preWipeCopy, { force: true });
      await prisma.$queryRawUnsafe(`VACUUM INTO '${preWipeCopy.replace(/'/g, "''")}'`);
    } catch (err) {
      throw new BusinessRuleError(
        `Could not create a safety backup before wiping (${err instanceof Error ? err.message : 'unknown error'}). Nothing was deleted.`,
        500
      );
    }

    // Delete in FK-safe order (children before parents)
    await prisma.$transaction(async (tx) => {
      await tx.warranty.deleteMany();
      await tx.returnItem.deleteMany();
      await tx.exchangeReplacementItem.deleteMany();
      await tx.return.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.supplierPayment.deleteMany();
      await tx.purchase.deleteMany();
      await tx.serializedInventoryItem.deleteMany();
      await tx.product.deleteMany();
      await tx.customer.deleteMany();
      await tx.supplier.deleteMany();
      await tx.expense.deleteMany();
      await tx.auditLog.deleteMany();
    });

    const { resetSeedCache } = await import('@/lib/database/seed');
    resetSeedCache();

    return NextResponse.json({
      success: true,
      message: 'All shop data has been wiped. A snapshot was saved next to the database before deletion.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
