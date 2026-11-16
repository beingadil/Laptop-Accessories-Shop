/**
 * Retries an interactive Prisma transaction when it aborts on a unique-constraint
 * collision for a human-facing document number (invoice/PO/return numbers).
 * Two concurrent sales can compute the same candidate number; after a P2002 the
 * caller re-probes the max used sequence instead of surfacing a spurious 409.
 */
export async function withTransactionRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string } | null)?.code;
      const target = (error as { meta?: { target?: string[] } } | null)?.meta?.target ?? [];
      const isDocumentNumberCollision =
        code === 'P2002' &&
        Array.isArray(target) &&
        target.some((field) =>
          ['invoiceNumber', 'purchaseNumber', 'returnNumber'].includes(field)
        );
      if (!isDocumentNumberCollision || attempt === attempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}
