# PERFORMANCE_AUDIT.md — Performance Baseline & Findings

**Date:** 2026-11-16
**Method:** static analysis + `next build` output inspection. **No runtime profiling has been performed yet** — startup/navigation/memory numbers below are either build-reported or marked [TBD — measure]. Do not treat them as measured.

## 1. Measured build baselines (2026-11-16, after Google-dep removal + Windows build fixes)

| Metric | Measured |
|---|---|
| Shared First Load JS | **103 kB** (chunks 1255… 46.3 kB + 4bd1b696… 54.2 kB + 2.25 kB other) |
| First Load JS per page | **129–172 kB** (heaviest: /sales 172, /purchases 171, /returns 169, /reports 170) |
| Dashboard (`/`) extra | **+~392 kB recharts chunk** — eagerly imported in `DashboardView.tsx:5-16` |
| exceljs chunk | ~911 kB — dynamic `import()`, only on export click ✓ |
| jspdf (+autotable) | ~328 kB — dynamic ✓ |
| CSS | ~35–40 kB single stylesheet |
| Middleware | 34.8 kB no-op — should be deleted |
| Build | ✅ succeeds on Windows (post hoisted-linker + tracing-root fixes) |

## 2. Key findings (evidence in parentheses)

1. **recharts on the critical path of `/`** — 392 kB parsed before dashboard interactive; charts sit below KPI cards (DashboardView.tsx:5). Fix: `next/dynamic` split.
2. **30/55 `page.tsx` are client components** fetching in `useEffect`; `/` is the only RSC-with-services page. Double serialization + full skeleton on every navigation; no `loading.tsx`/`error.tsx` anywhere under `app/`.
3. **`products?all=1` returns entire catalog incl. every IN_STOCK serialized unit** to populate dropdowns (SaleForm.tsx:110, PurchaseForm.tsx:86, opening-stock/page.tsx:45, adjustments/page.tsx:62, returns/exchange/page.tsx:104). Multi-hundred-KB JSON parsed per invoice line; `SearchableSelect` renders all options as DOM (searchable-select.tsx:123).
4. **Global search = 11 parallel `contains` LIKE scans per debounced keystroke** (AppShell.tsx:390→`/api/search`, debounce 180 ms). No caching.
5. **Fetch-all-then-filter server paths**: products LOW_STOCK (products/route.ts:84-92), reports inventory valuation (reports/route.ts:138-154), `export=1` unbounded dumps (reports/route.ts: various), supplier ledger built by loading all purchases+payments then sorting in memory (suppliers/[id]/route.ts:17-32,96-107).
6. **`useEffect` without AbortController/catch** in most detail pages (products/[id]/page.tsx:62, sales/[id]/page.tsx:50…) → setState-after-unmount, perpetual skeleton on failure. List pages do use AbortController correctly (products/page.tsx:67-89).
7. **No memoization architecture**: 0 `React.memo` in repo; every list page re-creates `columns` arrays per render feeding unmemoized `DataTable.tsx:59`. SaleForm re-derives per-line dropdown option arrays per keystroke (SaleForm.tsx:407).
8. **Root layout forces dynamic + double branding DB read per document** (layout.tsx:7,10,31); base64 logo (≤1 MB) re-embedded in RSC payload, provider state, and every `<img>` (BrandMark.tsx:40).
9. **Exports run ExcelJS/jsPDF on the main thread** over unbounded `export=1` result sets (reports/page.tsx:437-478) — multi-second UI freeze at volume.
10. **Reports customers summary**: `totalSpent` computed over current page only — correctness + perf smell (reports/route.ts:290).
11. **`middleware.ts` no-op** executes on every request — 34.8 kB edge bundle + invocation cost for nothing.
12. **Dead config**: `transpilePackages:['motion']` (motion imported nowhere); `eslint.ignoreDuringBuilds:true`.

## 3. Proposed targets (set after baseline review, not invented)

| Target | Rationale |
|---|---|
| `/` first load JS ≤ ~150 kB (from ~495 kB) | dynamic-import recharts; measure again |
| Zero `/api/*` fetch during RSC-renderable page loads | convert list/detail pages to RSC or stream |
| `/api/products` dropdown mode returns ≤5 fields, no nested serials | kill 100s KB parses in SaleForm |
| Search: ≤6 parallel queries + 60 s client cache | responsiveness on keystroke |
| No full-table JS filtering in routes | move predicates into SQL (or $queryRaw for column-vs-column) |
| Startup-to-usable in Electron ≤ 4 s cold [TBD on target hardware] | measure on shop PC, not dev laptop |

## 4. Measurement plan (Phase 1 execution)

1. Build `ANALYZE=1` bundle (add `@next/bundle-analyzer` as devDep **only if approved**) or use `next build` chunk table.
2. Add `why-did-you-render`? — no (overkill). Use React DevTools Profiler manually on `/`, `/sales/new`, `/products` before/after.
3. Electron startup: `console.time` from main-entry to `BrowserWindow.show` + `/api/health` first 200. Record in this file.
4. Memory: `process.memoryUsage()` IPC endpoint behind `app.isPackaged === false` dev flag.
5. Re-run `pnpm build` after each perf change; keep First Load JS table diff in CHANGELOG.

## 5. What was NOT done yet

- No runtime trace of navigation TTI.
- No IndexedDB/SQLite query timing instrumentation.
- No virtualized lists (page sizes ≤100 already; SearchableSelect capped instead — see ROADMAP Phase 1).
