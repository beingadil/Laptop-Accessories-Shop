# TECH_DEBT.md — Technical Debt & Known Defects

**Date:** 2026-11-16 · **Sources:** two independent deep audits (API/services; frontend/perf), evidence-cited.
Severity: 🔴 release-blocker · 🟠 high · 🟡 medium · ⚪ low

## A. Security — MUST fix before any release

| # | Sev | Item | Evidence |
|---|---|---|---|
| A1 | 🔴 | `requireAuth()` never verifies the cookie; whole API open to anonymous callers | `lib/api-utils.ts:24-47`; `getSession()` never called; `middleware.ts` no-op; `/api/auth/session` always true |
| A2 | 🔴 | Fresh install auto-creates `admin`/`admin123` + demo data, no forced change | `lib/database/seed.ts:41-50,104-106` |
| A3 | 🔴 | Hardcoded JWT secret fallback in source | `lib/auth-edge.ts:11-14` |
| A4 | 🔴 | DB restore overwrites live DB with unvalidated/unauthenticated input; `settingsCount < 0` rollback dead code | `app/api/backup/route.ts:53-115` |
| A5 | 🟠 | Refund amounts uncapped vs line totals (money destruction) | `lib/validation/schemas.ts:139`, `lib/services/returns.ts:82-118,226,559` |
| A6 | 🟠 | Zero rate-limit/brute-force protection on login & password change; bcrypt skipped on unknown user (timing oracle) | `app/api/auth/login/route.ts:8-49`, `app/api/settings/password/route.ts:7-51` |
| A7 | 🟠 | Unbounded payloads: `logoDataUrl` no max; `reports?export=1` unbounded; backup upload no size cap | `lib/validation/schemas.ts:171`, `app/api/reports/route.ts:*`, `app/api/backup/route.ts:58-71` |
| A8 | 🟡 | No security headers / CSP in `next.config.ts`; cookie `sameSite:'none'` in https context defeats CSRF | `next.config.ts`, `lib/auth.ts:47-57` |
| A9 | 🟡 | Mass-assignment latent: zod strips unknown keys but nothing uses `.strict()` — one schema edit = new writable field | `lib/validation/schemas.ts` (no `.strict()`) |
| A10 | 🟡 | Username enumerable via login timing | `app/api/auth/login/route.ts:18-25` |
| A11 | ⚪ | Branding endpoint publicly leaks shop address/phones/logo (by design for login page, but over-discloses) | `app/api/branding/route.ts:6-13` |

## B. Correctness — inventory & money

| # | Sev | Item | Evidence |
|---|---|---|---|
| B1 | 🔴 | Oversell / lost update: absolute `currentStock` write from deferred snapshot (sale, update, purchase) | `lib/services/sales.ts:188-207,436-450`, `lib/services/purchases.ts:163-221` |
| B2 | 🔴 | Double-sell of last serialized unit: no conditional `WHERE stockStatus='IN_STOCK'` on update | `lib/services/sales.ts:112,195-198` |
| B3 | 🟠 | Return over-return race: both concurrent returns pass `quantity ≤ remaining` check then both increment | `lib/services/returns.ts:75-80,137,414` |
| B4 | 🟠 | Invoice/PO/return numbering count-based → collisions abort transactions (P2002 → 409 on legit sale) | `lib/services/sales.ts:33-47`, `purchases.ts:59-73`, `returns.ts:12-21` |
| B5 | 🟠 | Exchange replacement warranty bound to first original `saleItemId`, hard-coded 1 month | `lib/services/returns.ts:526-541` |
| B6 | 🟡 | `ADJUSTMENT_OUT` collapses into DAMAGED serial status | `lib/services/inventory.ts:229-234` |
| B7 | 🟡 | `updatePurchase` drops `sellingPrice`; per-serial movement stock numbers identical/wrong; purchase reversal deletes serial history | `purchases.ts:171-219,462-471,190-199,280-291,294-304` |
| B8 | 🟡 | NaN dates reach writes in most update paths (only creates guard) | `sales.ts:334`, `purchases.ts:349`, `returns.ts:51,260`, `supplier-payments/*`, `expenses/*` |
| B9 | 🟡 | Unvalidated enum strings → Prisma throws → 500 (should be 400) | `purchases/route.ts:22`, `sales/route.ts:24`, `inventory/movements/route.ts:29`, `inventory/route.ts:31` |
| B10 | 🟡 | Timezone-naive `YYYY-MM-DD` filters interpreted as UTC (off by +5h PKT) | `expenses/purchases/sales/reports/returns/supplier-payments routes` |
| B11 | ⚪ | Money as `Float` everywhere; rounding only in one cost path | `prisma/schema.prisma` (all monetary fields), `lib/domain/calculations.ts:28` |
| B12 | 🟡 | Supplier ledger clamps negative balances (overpayment hidden) | `app/api/suppliers/[id]/route.ts:100` |
| B13 | 🟡 | Reports: `totalSpent` sums current page only | `app/api/reports/route.ts:290` |
| B14 | ⚪ | `calculateExchangeSummary` computed but ignored; stored profit uses different formula | `lib/domain/calculations.ts:109-126` vs `returns.ts:378-392` |

## C. Structure & duplication

| # | Item | Evidence |
|---|---|---|
| C1 | ~59 copies of the same fake-auth guard + pagination envelope across routes | grep `errorResponse` (59), `parsePaginationParams` |
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

1. A1–A4 (auth, seed creds, secret, restore hardening)
2. B1, B2, B4 (atomic stock + numbering)
3. A5, B3 (caps, over-return)
4. A6, A7, A8 (rate limit, payload caps, headers)
5. A9, B8, B9, B10 (schema strictness, date/enum validation, TZ)
6. D1–D6 (perf quick wins)
7. C1–C9, D7–D10 (structural, incremental, no behavior change)
