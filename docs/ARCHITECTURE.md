# ARCHITECTURE.md — Current Application Architecture

> Describes the app as it exists after the 2026-11-16 dependency cleanup.
> Target (post-Phase 4) shape in §6.

## 1. Runtime topology

```text
┌────────────────────────── Electron (Windows) ──────────────────────────┐
│  electron/main.js (main process)                                       │
│   ├─ picks free port (default 3456)                                    │
│   ├─ copies prisma/dev.db → userData/data/tayyab-enterprises.db        │
│   │   on first run (seed), creates userData/data/.auth-secret          │
│   ├─ spawns embedded Next server: ELECTRON_RUN_AS_NODE .next/standalone│
│   │   with env DATABASE_URL, AUTH_SECRET, PORT, HOSTNAME=127.0.0.1      │
│   ├─ polls /api/health then loads http://127.0.0.1:<port>              │
│   ├─ IPC: print window, save/restore DB backup, app info               │
│   └─ window: 1400×900, min 1180×740, preload contextBridge             │
│                                                                        │
│  electron/preload.js → window.electronAPI (printWindow, saveBackupToDisk│
│   pickBackupFile, getDesktopInfo). contextIsolation on, nodeIntegration │
│   off, sandbox on.                                                     │
└────────────────────────────────────────────────────────────────────────┘
                 │ HTTP on 127.0.0.1 (loopback only)
┌────────────────▼───────────── Next.js standalone server ───────────────┐
│  App Router pages (RSC shell + client pages)                           │
│  Route handlers app/api/* ──► zod validation (lib/validation/schemas)  │
│      ──► services (lib/services/*) ──► Prisma ──► SQLite (WAL)         │
│  middleware.ts: no-op                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Module responsibilities

| Module | Responsibility |
|---|---|
| `app/api/**` | HTTP: parse, validate (zod), authorize (currently broken), envelope `{items,total,page,pageSize}` |
| `lib/services/*.ts` | Business logic + transactions (sales, purchases, returns, inventory, reports, branding, audit) |
| `lib/domain/calculations.ts` | Pure math: sale totals, profit, exchange summary (unit-testable) |
| `lib/validation/schemas.ts` | zod schemas shared by routes |
| `lib/prisma.ts` | PrismaClient singleton (global cache for dev HMR) |
| `lib/database/seed.ts` | `ensureDatabaseSeeded()` — creates default admin, shop settings, demo data |
| `lib/api-utils.ts` | `requireAuth()` (fake — see TECH_DEBT), `handleApiError()` (Zod/BusinessRule/Prisma→HTTP map) |
| `lib/auth(-edge).ts` | JWT sign/verify (jose, HS256, 7d), cookie helpers, bcrypt hashing + session getters |
| `components/*` | UI by area: `auth/LoginView`, `branding/BrandMark+BrandingProvider`, `dashboard/DashboardView`, `forms/*` (SaleForm etc.), `layout/AppShell` (nav + global search), `tables/DataTable`, `ui/*` (shadcn primitives) |
| `hooks/*` | `use-debounced-value`, `use-mobile` |

## 3. Authentication flow (as designed vs as-wired)

Designed: login form → `POST /api/auth/login` (bcrypt verify) → `jose` HS256 JWT in
`httpOnly` cookie (`tayyab_admin_session`, 7d) → middleware … → routes verify cookie
via `getSession()`.

As wired: login still sets the cookie correctly, but **no route verifies it**;
`requireAuth()` returns the first admin row; `middleware.ts` is a no-op;
`/api/auth/session` always returns `{authenticated:true}`. UI is also incapable of
reaching "logged out" state. (Audit: both read paths, `lib/auth.ts:22` and
`lib/api-utils.ts:24`.)

## 4. Data model (Prisma, SQLite)

~30 models. Core chains:

- **Inventory**: `Product` (QUANTITY|SERIALIZED) → `SerializedInventoryItem`
  (IN_STOCK/SOLD/RETURNED_DEFECTIVE/DAMAGED/LOST) → `StockMovement` (OPENING_STOCK,
  PURCHASE, SALE, SALE_RETURN, EXCHANGE_IN/OUT, ADJUSTMENT_IN/OUT, REVERSAL…).
- **Sales**: `Sale` → `SaleItem` (returnedQuantity, unitCost for profit) →
  `Return`/`ReturnItem`/`ExchangeReplacementItem`, `Warranty` (per SaleItem).
- **Purchasing**: `Purchase` → `PurchaseItem`; `Supplier` → `SupplierPayment`;
  supplier ledger derived in `app/api/suppliers/[id]` (running balance, in-memory).
- **Finance**: `Expense` → `ExpenseCategory`.
- **Identity**: `AdminUser`; `ShopSettings` (singleton `id='default'`); audit via `AuditLog`.

See `prisma/schema.prisma`. No migration history — `prisma db push` workflow.

## 5. Rendering model

- One RSC page (`app/page.tsx`, `/login`) fetches services directly server-side.
- **All other pages are client components** fetching `/api/*` in `useEffect` —
  double round-trip, unmemoized columns, no `loading.tsx`/`error.tsx` (see
  PERFORMANCE_AUDIT.md).
- Branding: `app/layout.tsx` is `force-dynamic` and calls `getShopBranding()` twice
  per document (generateMetadata + RootLayout) — dedupe with React `cache()` (planned).

## 6. Target architecture (post Phase 2/4)

```text
Electron main ─ spawns Next standalone (unchanged packaging shape)
API routes     ─ real requireAuth() → 401 JSON; zod .strict(); size caps
Services       ─ atomic stock updates (UPDATE…WHERE stock>=? / conditional updateMany),
                 count-free invoice numbering (max seq probe), refund caps
Renderer       ─ RSC where data is static-ish, dynamic imports for recharts/exceljs/jspdf,
                 loading.tsx/error.tsx boundaries, memoized table columns
```

Unchanged by design: SQLite in `userData` (never repackaged over user data),
`prisma/dev.db` as first-run seed, single-machine offline operation, PKR currency.
