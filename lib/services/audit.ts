import type { Prisma } from '@prisma/client';

export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    previousData?: unknown;
    updatedData?: unknown;
    adminUserId?: string | null;
  }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      previousData: params.previousData !== undefined ? JSON.stringify(params.previousData) : null,
      updatedData: params.updatedData !== undefined ? JSON.stringify(params.updatedData) : null,
      adminUserId: params.adminUserId ?? null,
    },
  });
}
