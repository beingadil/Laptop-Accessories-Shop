# TESTING_STRATEGY.md — Test Plan & Commands

**Status:** proposal (Phase 3). No test runner installed yet; three orphan test files exist (`lib/branding.test.ts`, `lib/date-utils.test.ts`, `lib/domain/calculations.test.ts` — written for a Jest-like runner, unverified).

## 1. Stack

| Purpose | Tool |
|---|---|
| Runner + assertions | **Vitest** (fast, ESM-native, TS out of box) |
| Component tests | **React Testing Library** + jsdom |
| E2E / workflows | **Playwright** (Windows Chromium) |
| DB tests | Vitest + temp SQLite file via `DATABASE_URL=file:./test-<rand>.db` + `prisma db push` in setup |
| Lint / types | ESLint 9 flat config, `tsc --noEmit` |

Vitest over Jest: project is ESM-first, no babel, faster, single binary, plays well with pnpm.

## 2. Commands (to add to package.json)

```jsonc
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"build": "next build",
"ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
```

## 3. Coverage priorities (what actually protects the shop)

1. **Money & stock** — `lib/domain/calculations.ts`, `lib/services/sales.ts`,
   `purchases.ts`, `returns.ts`, `inventory.ts`: sale totals, profit, refund caps,
   atomic decrement (concurrent test), numbering collision retry, over-return guard.
2. **Auth** — login throttle, token verify, `requireAuth()` 401/200 matrix,
   password change, session invalidation semantics.
3. **Validation** — zod schemas: NaN dates, bad enums, oversized logo, refund > line.
4. **Regression** — every route's happy path against a seeded temp DB
   (products create → purchase → sale → return → report totals reconcile).
5. **UI components** — DataTable pagination, SearchableSelect cap, LoginView flow,
   BrandingProvider (RTL).
6. **E2E** (Playwright) — login → create sale (2 items incl. serialized) → invoice
   renders → PDF export called; backup download; settings save; returns flow.
   Run offline against `pnpm build && pnpm start` port.

## 4. Test layout

```text
tests/
  unit/        calculations, date-utils, branding, validation, auth-edge
  integration/  services vs temp SQLite (sales/purchases/returns/inventory)
  api/          route handlers: inject Request, assert envelope + status
  e2e/          playwright: full workflows
  fixtures/     seed builders (small, deterministic)
```

## 5. Rules

- **No fake passes.** A test is green only if executed and asserted. Skipped tests are listed in output, never in release notes.
- CI (GitHub Actions) must run: lint → typecheck → unit+integration → build. E2E on Windows runner for release workflow.
- Coverage is reported, not gated, until baseline established (target: ≥80% on `lib/domain` + `lib/services`).
- Every fixed bug lands with the test that would have caught it.

## 6. Existing orphans — dispositions

| File | Disposition |
|---|---|
| `lib/branding.test.ts` | Port to `tests/unit/branding.test.ts`; verify expectations |
| `lib/date-utils.test.ts` | Port; also codify TZ-safe date filter behavior |
| `lib/domain/calculations.test.ts` | Port; extend: refund cap, exchange summary |
