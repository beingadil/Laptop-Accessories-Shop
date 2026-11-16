# TESTING.md — Test Plan & Commands

**Status:** active (2026-11-16). Test runner: **`node --test`** with Node 26's native TypeScript stripping — zero test dependencies, fully offline. The earlier Vitest plan was dropped on purpose (simplicity first; the app is a single-machine desktop tool, not a distributed system).

## 1. Stack (as implemented)

| Purpose | Tool |
|---|---|
| Unit + integration runner | **`node --test`** (+ `--import ./tests/register-aliases.mjs` for the `@/` path alias) |
| Assertions | `node:assert/strict` |
| DB integration tests | Real temporary SQLite via `prisma db push`, torn down after |
| E2E | Deferred to CI (Phase 7) — Playwright there; local E2E optional, not gating |
| Lint / types | ESLint 9 flat config (`eslint .` — clean), `tsc --noEmit` |

## 2. Commands (in package.json)

```bash
pnpm lint           # ESLint — must pass with 0 errors
pnpm typecheck      # tsc --noEmit — must pass
pnpm test           # node --test, all suites below
pnpm test:watch
pnpm build          # next build (standalone)
pnpm ci             # lint + typecheck + test + build (what GitHub Actions runs)
```

## 3. Test inventory (all executed 2026-11-16, all green)

| Suite | Coverage | Result |
|---|---|---|
| `lib/domain/calculations.test.ts` | weighted avg cost, sale totals, net profit, supplier outstanding, exchange summary, warranty dates, serial uniqueness, stock deduction | 18 tests (incl. neighboring files) ✔ |
| `lib/date-utils.test.ts` | date value parse/leap years, calendar grid | ✔ |
| `lib/branding.test.ts` | initials, phones, footer text, slugify, normalize | ✔ |
| `tests/unit/auth-edge.test.ts` | JWT sign/verify roundtrip, tamper rejection, garbage token, wrong-secret rejection | 4 ✔ |
| `tests/integration/sales.integration.test.ts` | **real temp SQLite**: stock decrement on sale, oversell rejected (stock untouched), serialized double-sell rejected (atomic claim), refund above paid amount rejected, sane refund OK, distinct invoice numbers | 5 ✔ |

The three `lib/*.test.ts` files import with explicit `.ts` extension (project has `allowImportingTsExtensions`).

## 4. Authoritative test for the audit's bug classes

| Audit finding | Test that guards it |
|---|---|
| B1 sale oversell / stock race | `sales.integration.test.ts` — "oversell is rejected and stock is untouched" |
| B2 serial double-sell | "serialized unit cannot be sold twice (atomic claim)" |
| A5 refund uncapped | "refund above paid amount is rejected" |
| B4 invoice number collision | "two consecutive sales receive distinct invoice numbers" + P2002 retry wrapper |
| A3/A10 auth | `auth-edge.test.ts` roundtrip + tamper/wrong-secret |

## 5. Conventions

- New service-level tests go in `tests/integration/` (temp DB pattern in `sales.integration.test.ts` — copy the fixture helpers).
- New pure-function tests either co-locate as `lib/*.test.ts` (keep pattern) or land in `tests/unit/`.
- Integration DB is `tests/integration/.tmp-integration.db` — created by `prisma db push`, deleted after. Never point tests at `prisma/dev.db`.
- **No fake passes.** CI is the arbiter; a suite is green only if it ran. Skipped tests, if ever added, must print why.
- E2E (login → sale → invoice PDF) belongs to CI artifacts (Phase 7), not to `pnpm test`.

## 6. Orphan tests — disposition

All three ported unchanged except imports gained explicit `.ts` extensions. They now run in `pnpm test`.

## 7. Not yet covered (known gaps — Phase 3.2)

- Return-flow over-return race (B3) — needs conditional-increment implementation first.
- Purchase reversal integration path (stock returned correctly).
- `/api/*` route-level tests (validation 400s) — services covered via integration; routes rely on zod at the boundary.
- Playwright smoke (login → dashboard renders) — CI.
