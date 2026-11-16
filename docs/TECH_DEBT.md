# TECH_DEBT.md — Technical Debt & Known Defects

**Date:** 2026-11-16 · **Sources:** two independent deep audits (API/services; frontend/perf), evidence-cited.
Severity: 🔴 release-blocker · 🟠 high · 🟡 medium · ⚪ low

## A. Security — MUST fix before any release

| # | Sev | Item | Evidence |
|---|---|---|---|
| A1 | 🔴 ✅ FIXED 2026-11-16 | `requireAuth()` now verifies the session cookie (401 otherwise); middleware redirects pages→/login and 401s `/api/*`; `/api/auth/session` truthful | `lib/api-utils.ts`, `middleware.ts`, `app/api/auth/session/route.ts` |
| A2 | 🟠 PARTIAL | Fresh install still seeds `admin`/`admin123`; now documented + verified present in committed `dev.db`; forced password change on first login NOT implemented yet | `lib/database/seed.ts:41-50` |
| A3 | 🔴 ✅ FIXED 2026-11-16 | Hardcoded fallback secret removed for production (fail-fast AUTH_SECRET ≥32 chars; dev-only fallback) | `lib/auth-edge.ts` |
| A4 | 🔴 ✅ FIXED 2026-11-16 | Restore: size cap 250 MB (413), magic bytes, core-table structural check, WAL checkpoint before snapshot, `quick_check` + smoke counts, **auto-rollback** to `.pre-restore.bak` on integrity failure | `app/api/backup/route.ts` |
| A5 | 🟠 ✅ FIXED 2026-11-16 | Refund capped at prorated line total paid (`assertRefundWithinPaidAmount`) in return + exchange paths | `lib/services/returns.ts` |
| A6 | 🟠 ✅ FIXED 2026-11-16 (login/password throttle) | 5 attempts / 5 min fixed-window limiter on `/api/auth/login` and `/api/settings/password` (429 + Retry-After); timing oracle closed earlier; audit-logging of logins still pending | `lib/rate-limit.ts`, both routes |
| A7 | 🟠 ✅ FIXED 2026-11-16 | `logoDataUrl` capped at ~1.4 MB (schema max); `reports?export=1` still unbounded (flag remains an intentional full-export path — see D9) | `lib/validation/schemas.ts` |
| A8 | 🟡 ✅ FIXED 2026-11-16 | Security headers: nosniff, SAMEORIGIN frame, no-referrer, DNS-prefetch off (CSP deferred: needs nonced inline script strategy) | `next.config.ts` |
| A9 | 🟡 | Mass-assignment latent: zod strips unknown keys but nothing uses `.strict()` — one schema edit = new writable field | `lib/validation/schemas.ts` (no `.strict()`) — consciously deferred (risk of breaking existing forms); see memory.md |
| A10 | 🟠 ✅ FIXED 2026-11-16 | Login timing oracle closed (dummy bcrypt hash for unknown users) | `app/api/auth/login/route.ts` |
| A11 | ⚪ | Branding endpoint requires auth now (middleware) — over-disclosure resolved | `middleware.ts` |

## B. Correctness — inventory & money

| # | Sev | Item | Evidence |
|---|---|---|---|
| B1 | 🔴 ✅ FIXED 2026-11-16 | Atomic guarded decrements (`updateMany … currentStock >= qty`) in sales create/update + purchase reversals | `lib/services/sales.ts`, `purchases.ts` |
| B2 | 🔴 ✅ FIXED 2026-11-16 | Atomic serial claim (`updateMany stockStatus='IN_STOCK'`) — double-sell rejected 400 | `lib/services/sales.ts` |
| B3 | 🟠 | Over-return race: guarded partially by interactive-tx retry; full fix = conditional increment (`updateMany returnedQuantity+qty<=quantity`) — pending | `lib/services/returns.ts` |
| B4 | 🟠 ✅ FIXED 2026-11-16 | Numbering probes MAX(docNo)+1 (not count) + `withTransactionRetry` on P2002 (sales/purchases/returns) | `lib/services/tx-retry.ts`, services |
| B5 | 🟠 | Exchange replacement warranty bound to first original `saleItemId`, hard-coded 1 month | `lib/services/returns.ts:526-541` |
| B6 | 🟡 | `ADJUSTMENT_OUT` collapses into DAMAGED serial status | `lib/services/inventory.ts:229-234` |
| B7 | 🟡 | `updatePurchase` drops `sellingPrice`; per-serial movement stock numbers identical/wrong; purchase reversal deletes serial history | `purchases.ts:171-219,462-471,190-199,280-291,294-304` |
| B8 | 🟡 ✅ FIXED 2026-11-16 | All 7 date body fields validated parseable via `dateField` refinement (400 not 500); NaN guard added to `updateSale` | `lib/validation/schemas.ts`, `lib/services/sales.ts` |
| B9 | 🟡 ✅ FIXED 2026-11-16 | Enum query params validated against allow-lists via `parseEnumParam` → 400 (was: Prisma threw → 500) | `lib/api-utils.ts`, 4 routes |
| B10 | 🟡 ✅ FIXED 2026-11-16 | `dateFrom`/`dateTo` filters parsed as LOCAL calendar dates (was UTC → off-by-one day in PKT) via `parseDateParam` | `lib/api-utils.ts`, 6 routes |
| B11 | ⚪ | Money as `Float` everywhere; rounding only in one cost path | `prisma/schema.prisma` (all monetary fields), `lib/domain/calculations.ts:28` |
| B12 | 🟡 | Supplier ledger clamps negative balances (overpayment hidden) | `app/api/suppliers/[id]/route.ts:100` |
| B13 | 🟡 | Reports: `totalSpent` sums current page only | `app/api/reports/route.ts:290` |
| B14 | ⚪ | `calculateExchangeSummary` computed but ignored; stored profit uses different formula | `lib/domain/calculations.ts:109-126` vs `returns.ts:378-392` |

## C. Structure & duplication

| # | Item | Evidence |
|---|---|---|
| C1 | ~59 copies of the same `requireAuth` guard + pagination envelope across routes (guards are real now, still duplicated — extract shared `withAuth`/`jsonList` helpers) | grep `errorResponse` (59), `parsePaginationParams` |
| C2 | Sale create vs update (~200 lines mirrored); purchase create vs update | `sales.ts:49-258` vs `331-499`; `purchases.ts:75-250` vs `341-505` |
| C3 | Three divergent number-generators (invoice/PO/return) | see B4 |
| C4 | `lib/api-utils.ts` imports `ensureDatabaseSeeded` — auth check is also the seeder (layering inversion) | `lib/api-utils.ts:8` |
| C5 | Dead exports: `setSessionCookie`/`clearSessionCookie` never called; `requireAuth().errorResponse` fiction | `lib/auth.ts:87-106`, `lib/api-utils.ts:26-31` |
| C6 | `warranties/[id]/route.ts` defines zod schema inline; hard-coded `paymentMethod: z.literal('CASH')` | `warranties/[id]/route.ts:7-11`, `schemas.ts:94,115` |
| C7 | Missing audit log on expense-categories POST; no PATCH/DELETE (asymmetry); login/logout unaudited | `expense-categories/route.ts:28` |
| C8 | Double error-handling styles (handleApiError vs ad-hoc NextResponse.json) | e.g. `customers/[id]/route.ts:44` vs `purchases` service |
| C9 | Duplicate ESLint configs (`eslint.config.mjs` + `.eslintrc.json`); lint suppressed in build | `next.config.ts:6` |

## D. Frontend debt (perf + resilience)

| # | Item | Evidence |
|---|---|---|
| D1 | recharts eagerly on `/` | `DashboardView.tsx:5-16` |
| D2 | 30/55 pages client-fetching; no RSC; no `loading.tsx`/`error.tsx` | audit §3 table |
| D3 | `products?all=1` full-catalog+serials for dropdowns | products/route.ts:15-47 |
| D4 | `SearchableSelect` unvirtualized, no option cap; SaleForm rebuilds option arrays per keystroke | `searchable-select.tsx:123`, `SaleForm.tsx:407` |
| D5 | Fetch-all-then-filter LOW_STOCK / reports valuation / supplier ledger | products/route.ts:84, reports/route.ts:138, suppliers/[id]/route.ts:96 |
| D6 | Return-eligibility fetches 100 sales then client-filters (silent cap) | `returns/new/page.tsx:84-93`, `exchange/page.tsx:103-110` |
| D7 | Unmemoized `DataTable`; per-render `columns` recreation everywhere | `DataTable.tsx:59`, all list pages |
| D8 | Detail pages: effect fetch w/o AbortController/catch/error UI | `products/[id]/page.tsx:62` et al. |
| D9 | `export=1` dumps + main-thread ExcelJS/jsPDF; list-page exports silently truncate at 100 rows | reports/page.tsx:437-478, products/page.tsx:129, sales/page.tsx:104 |
| D10 | base64 logo ≤1 MB in RSC payload + provider + every `<img>` | `BrandMark.tsx:40`, layout.tsx |

## E. Hygiene / housekeeping (done 2026-11-16 unless noted)

- ~~Google/AI-Studio deps: `@google/genai`, `firebase-tools`, `next/font/google`, `picsum.photos`, `GEMINI_API_KEY`, `metadata.json`, AI-Studio folder~~ **Removed**
- ~~`bun.lock` vs pnpm confusion → pnpm only~~ **Removed**
- ~~Windows standalone build EPERM (hoisted linker) + home-dir tracing root~~ **Fixed**
- `.next/standalone` symlink copy still emits warnings on some trees? — **verify after each dep change**; current build clean.
- `prisma/dev.db-shm/-wal` files were committed (live WAL artifacts) — **to untrack** (seed must be checkpointed first).
- `tsconfig.tsbuildinfo` untracked ✓. `dist-electron/` gitignored ✓.
- `prisma` CLI is in `dependencies` (should be devDependency) — move pending.
- `.env` exists locally (gitignored) with dev AUTH_SECRET — do not commit.

## Fix order (drives Phase 1→3)

1. ~~A1–A4 (auth, seed creds, secret, restore hardening)~~ **A1, A3, A4, A10 done 2026-11-16** — A2 (forced password change) pending
2. ~~B1, B2, B4 (atomic stock + numbering)~~ **done 2026-11-16** — B3 (over-return conditional increment) pending
3. ~~A5, B3 (caps, over-return)~~ **A5 done** — B3 pending
4. ~~A6, A7, A8 (rate limit, payload caps, headers)~~ **done 2026-11-16** — login/password audit-logging still pending
5. ~~A9, B8, B9, B10 (schema strictness, date/enum validation, TZ)~~ **B8, B9, B10 done; A9 consciously deferred** (real-form breakage risk)
6. D1–D6 (perf quick wins)
7. C1–C9, D7–D10 (structural, incremental, no behavior change)
