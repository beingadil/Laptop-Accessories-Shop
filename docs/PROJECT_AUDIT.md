# PROJECT_AUDIT.md — Tayyab Enterprises Management System

**Audit date:** 2026-11-16
**Auditor:** OpenCode (automated audit, evidence-cited)
**Scope:** full repository inspection — config, source, Prisma schema, Electron shell, build output.
**Status:** Phase 0 audit — for review before Phase 1 implementation.

---

## 1. Stack summary

| Concern | Value |
|---|---|
| Framework | Next.js **15** (installed 15.5.29, `package.json: next ^15.4.9`) |
| UI | React **19** (installed 19.3.x, `^19.2.1`), App Router |
| Language | TypeScript 5.9.3, `strict: true` (`tsconfig.json`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, `@import "tailwindcss"` in `app/globals.css`) |
| Components | shadcn-style primitives in `components/ui/` (Radix UI) + custom |
| ORM / DB | Prisma 6.19.x → **SQLite** (`prisma/schema.prisma`, `enum`-heavy, ~30 models) |
| Auth | JWT (`jose`), bcryptjs password hashing — **currently non-enforcing, see §6 & TECH_DEBT.md** |
| Exports | `exceljs` (Excel), `jspdf` + `jspdf-autotable` (PDF) — dynamic imports |
| Charts | `recharts` (dashboard only) |
| Desktop | Electron (main: `electron/main.js`, preload: `electron/preload.js`) + `electron-builder` (NSIS), `output: 'standalone'` |
| Package manager | **pnpm 11.8.0** (`pnpm-lock.yaml`, hoisted linker via `pnpm-workspace.yaml`). bun.lock removed 2026-11-16. |
| Node | v26.3.0 (dev machine) |

## 2. Repository layout

```text
app/            Next.js App Router — pages + api/ route handlers (~47 routes)
components/     auth/, branding/, dashboard/, forms/, layout/, tables/, ui/
hooks/          use-debounced-value, use-mobile
lib/            api-utils, auth(-edge), prisma, branding, export(-invoice-pdf),
                services/ (sales, purchases, returns, inventory, reports, branding, audit),
                domain/calculations.ts, database/seed.ts, validation/schemas.ts, utils/format
prisma/         schema.prisma, dev.db (committed as Electron seed), migrations absent (db push workflow)
public/         static assets (aistudio leftovers removed; PRD moved to docs/PRD.md)
electron/       main.js (embedded standalone Next server), preload.js (contextBridge)
docs/           this audit + PRD.md
middleware.ts   no-op pass-through (dead weight)
```

## 3. What the app is

A single-shop management system for a laptop/accessories shop in Pakistan (PKR):
products (quantity + serialized inventory), sales, purchases, suppliers + payments,
customers, expenses, returns/exchanges, warranties, stock movements/adjustments,
reports + Excel/PDF export, settings with shop branding (logo) and DB backup/restore,
audit log, and an initial seed with demo data. Single admin user. Offline-first,
single computer.

## 4. State management

- **No global store** (no Redux/Zustand). Server state is fetched per-page via
  `useEffect(fetch('/api/...'))`; client state is local `useState`.
- `BrandingProvider` context holds shop branding (init from RSC payload, refresh on
  `/api/branding` + `storage` events).
- URL search params are not used for list state (filters are component state).

## 5. Data layer

- Prisma + SQLite in WAL mode (`lib/database/seed.ts` executes pragmas).
- Business logic lives in `lib/services/*.ts` (good separation already); routes in
  `app/api/**` parse/validate (zod) → call services → envelope responses.
- Transactions: interactive `prisma.$transaction` used in services; several
  correctness/race issues catalogued in `TECH_DEBT.md` (#4, #6, #9 of the audit).
- No migrations folder — schema applied via `prisma db push`. No formal migration
  versioning. `dev.db` is committed and is the seed for packaged installs.
- Money is `Float`; stock math read-modify-write (see TECH_DEBT).

## 6. Authentication — as-found state (critical)

- `middleware.ts` is a no-op (`NextResponse.next()` for everything).
- `lib/api-utils.ts` `requireAuth()` **does not verify the session cookie**; it loads
  the first `AdminUser` row (or a stub) and returns it. All ~59 call sites gate on it.
- `getSession()`/`verifySessionToken()` exist but are never called.
- `/api/auth/session` always reports `authenticated: true`.
- Fresh install seeds `admin`/`admin123` and demo data automatically
  (`lib/database/seed.ts`).
- Hardcoded secret fallback in `lib/auth-edge.ts`.
- Details and fix plan: `TECH_DEBT.md` §Security; see also `ROADMAP.md` Phase 2.

## 7. Environment variables

| Var | Used for | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | dev: `file:./dev.db`; Electron injects `file:<userData>/data/tayyab-enterprises.db` |
| `AUTH_SECRET` | JWT signing | falls back to hardcoded constant (must fix) |
| `APP_URL` | https detection for cookie flags | optional |
| `DISABLE_HMR` | dev ergonomics | optional |

`.env.example` documents all; `.env` is gitignored. **GEMINI_API_KEY and all Google
dependencies were removed 2026-11-16** (app is fully offline).

## 8. External runtime dependencies

None. After the 2026-11-16 cleanup the app fetches nothing off-box: fonts are system
fonts, images are `<img>` with data URLs, no CDNs, no telemetry. Update checks (when
Phase 8 lands) will talk to GitHub Releases over HTTPS — the only intended exception.

## 9. Build & packaging (as-found, then fixed)

- `next build` with `output: 'standalone'` succeeded only after two Windows fixes:
  1. pnpm hoisted linker (`pnpm-workspace.yaml`, `nodeLinker: hoisted`) — symlinked
     `.pnpm` store broke Next's standalone file tracing (EPERM).
  2. `outputFileTracingRoot` pinned to project dir — a stray `package.json` in the
     user's home directory made Next trace from home, nesting
     `standalone/Desktop/LAPTOP MANAGEMENT SYSTEM/...`.
- `.next/standalone/server.js` now produced; Electron loads it on a free local port.
- `electron/main.js` already: per-user data dir (`userData/data/tayyab-enterprises.db`),
  JWT secret persisted next to the DB, port probing, backup/restore IPC, print IPC.
- electron-builder NSIS config present (desktop/start-menu shortcuts, install-dir
  selection) — no code signing yet; installer never been built/tested.

## 10. Tests (as-found)

Three test files exist — `lib/branding.test.ts`, `lib/date-utils.test.ts`,
`lib/domain/calculations.test.ts` — but **no test runner is installed** and
`package.json` has no `test` script. Tests are dead weight as committed.

## 11. Lint/format

- `eslint.config.mjs` (flat, `eslint-config-next` 16) + legacy `.eslintrc.json` both
  present (duplicate, confusing). `next.config.ts` sets
  `eslint.ignoreDuringBuilds: true` — lint signal suppressed in builds.
- `typescript.ignoreBuildErrors: false` — type errors DO fail the build (good).

## 12. Health assessment

**Functionally rich, architecturally promising, operationally unsafe as committed.**
The service-layer separation and validation discipline are real strengths. The two
structural facts that dominate all other work:

1. The API auth is decorative — the app must not be shipped, tagged, or released
   until real session enforcement lands (Phase 2).
2. Inventory money math is read-modify-write — overselling and lost updates are
   possible under any concurrency (Phase 2).

See `TECH_DEBT.md`, `PERFORMANCE_AUDIT.md`, `ROADMAP.md`.
