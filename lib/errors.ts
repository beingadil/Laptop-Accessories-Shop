/**
 * Dependency-free business error type. Lives alone so services and domain code
 * can import it without dragging in Next.js server machinery (next/server,
 * next/headers). `lib/api-utils.ts` re-exports it for existing call sites.
 */
export class BusinessRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessRuleError';
    this.status = status;
  }
}
