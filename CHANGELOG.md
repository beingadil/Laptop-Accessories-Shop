# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [1.0.1] - 2026-11-16 (tag `v1.0.1`)

Maintenance + security patch. Fixes the broken `Setup-1.0.0.exe` that could not start ("Timed out waiting for local application server to start"). Released on GitHub via Actions `release.yml`.

### Fixed
- **Startup failure in the packaged app**: electron-builder hard-drops the root `node_modules` of the `extraResources` source, so `standalone/server.js` had no runtime dependencies and crashed with `Cannot find module 'next'`. The installer now ships `standalone/node_modules` (verified: server healthy in ~1.3 s after install).
- Lockfile no longer ships a dev `.env` into the package (was present in Setup-1.0.0.exe via the standalone copy).

### Security
- `pnpm audit --prod --audit-level=high` now passes: 38 vulnerabilities (13 high, 2 critical) resolved via `jspdf@4.2.1`, `jspdf-autotable@5.0.9`, `zod@4.6.6`, and pnpm overrides (`postcss@8.5.18`, `deepmerge-ts@8.0.0`, `dompurify@3.4.17`). Remaining: 1 moderate (`uuid` via `exceljs`, unused code path).

### Added
- `startup.log` diagnostics in `%APPDATA%/tayyab-enterprises-management-system/logs/` (embedded-server stdout/stderr, spawn error/exit, DB path); the startup error dialog now points at it.
- Fail-fast when the local server exits before becoming healthy (instead of a blind 30 s wait), and a 90 s health-check tolerance for first-launch antivirus scans.

## [1.0.0] - 2026-11-16

First production release. All Google/AI-Studio dependencies removed; the app is fully offline.

### Security
- **Real authentication enforced end-to-end** across all ~59 API routes (session cookie verified) and pages (middleware redirect → /login); truthful `/api/auth/session`; dummy-hash login timing equalization; `AUTH_SECRET` fail-fast in production; login & password-change throttling (5/5min → 429); no logout existed before — added **Sign out** control in the sidebar (desktop + mobile).
- **Database restore hardened**: 250 MB cap, magic-byte + core-table validation, `quick_check` verification, **automatic rollback** to the pre-restore snapshot on integrity failure, WAL checkpoint before snapshotting.
- Refund amounts capped at prorated line totals (return + exchange). Security headers: nosniff, SAMEORIGIN, no-referrer, DNS-prefetch off. `logoDataUrl` size-capped (~1.4 MB). Enum query params allow-listed; zod date validation on all date fields (400 not 500); date filters interpreted as local calendar dates (was UTC, off-by-one day in PKT).
- Windows installer is **unsigned** — SmartScreen will flag it on first install (certificate pending, see SECURITY.md).

### Changed
- **Zero Google dependencies**: `@google/genai`, `firebase-tools` (+gRPC tree), `next/font/google` (offline system fonts), `GEMINI_API_KEY`, AI Studio artifacts. Lockfile verified clean.
- recharts (~392 kB) removed from the dashboard critical path via lazy `next/dynamic` chunks (dashboard First Load ≈ 132 kB).
- Package renamed `tayyab-enterprises-management-system`; repo home is `beingadil/Laptop-Accessories-Shop` (`main` is pushed).
- pnpm-only toolchain with `nodeLinker: hoisted` + `outputFileTracingRoot` (Windows EPERM fixes); standalone builds cleanly.
- `prisma/dev.db` is the first-run seed; live data stays in Electron `userData`.

### Fixed
- **Oversell / stock lost-update races**: atomic guarded decrements (`updateMany WHERE currentStock >= qty`) in sales create/update and purchase reversals; atomic serial claims (`stockStatus='IN_STOCK'`) prevent double-selling a laptop.
- Document numbering (invoice/PO/return) now probes MAX(docNo)+1; transactions retry on P2002 collisions.
- Return over-return race documented; partially mitigated (full conditional increment pending).

### Removed
- `motion` dependency (imported nowhere); dead `transpilePackages` config; no-op middleware content; `prisma/dev.db-shm/.wal` from tracking.

### Added
- **Testing from zero**: `node --test` runner — 27 tests green (calculations, date-utils, branding, auth-edge JWT, and real-SQLite integration tests of the atomic stock/refund paths). `pnpm ci` = lint + typecheck + test + build.
- **CI/CD**: `.github/workflows/ci.yml` (lint→typecheck→test→build on every push/PR), `release.yml` (tag `v*.*.*` → full gate → NSIS installer + `latest.yml` published to GitHub Releases via GITHUB_TOKEN), `security.yml` (dependency audit + secret scan).
- **Auto-update**: `electron-updater` wired (startup check + Settings → Updates tab: check/download/install, progress, version display).
- **NSIS installer built and tested end-to-end** (silent install, launch, silent uninstall; userData DB preserved).
- Docs: `docs/{PROJECT_AUDIT,ARCHITECTURE,PERFORMANCE_AUDIT,TECH_DEBT,TESTING,PRD,DATABASE,SECURITY,BUILD,RELEASE}.md`, `ROADMAP.md`, `memory.md`, `CHANGELOG.md`.

### Known issues
- No code signing (see SECURITY.md). No runtime migration runner — v1.x schema changes are additive-only; startup migration hook planned (DATABASE.md).
- `admin`/`admin123` default credentials on fresh installs — change immediately.

## [Unreleased]

### Added
- Application icon (`build/icon.svg` → `icon.png`/`icon-256.png`/`icon.ico`), drawn as vector geometry and wired into electron-builder (installer, uninstaller, shortcut, exe).
- Comprehensive `.gitignore`: all `.env*` variants, credential/key files, local machine config, build outputs, test temp DBs, OS/editor junk, root-level installer artifacts.
- `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/PERFORMANCE_AUDIT.md`, `docs/TECH_DEBT.md`, `docs/TESTING.md`, `ROADMAP.md`, `memory.md`, `.npmrc` (local, gitignored).

### Security
- **Real authentication enforced end-to-end** (2026-11-16). Previously the entire API was anonymously callable: `requireAuth()` returned the first admin row without verifying any cookie, `middleware.ts` was a no-op, `/api/auth/session` always reported authenticated. Now: `requireAuth()` verifies the HS256 session cookie via `jose` and returns 401 otherwise (all ~59 call sites enforced); `middleware.ts` redirects page requests to `/login` and answers `/api/*` with 401; login compares against a dummy bcrypt hash for unknown usernames (timing oracle closed); `AUTH_SECRET` now fails fast in production when missing/short (dev-only fallback retained); `/api/auth/session` reports the real session state; added an always-available **Sign out** control in the sidebar (no logout existed before).
- **Database restore hardened**: 250 MB upload cap (413), SQLite magic-byte validation, structural check that the backup contains this app's core tables, WAL checkpoint before snapshot, `quick_check` integrity verification after restore, and **automatic rollback** to the pre-restore copy on any integrity failure (the previous `settingsCount < 0` "check" could never trigger and the old code stranded in-memory connections before overwrite).
- Stateless-JWT note: password change re-issues a fresh cookie; old tokens remain valid until expiry (single-user desktop model) — documented, not yet version-pinned.

### Changed
- `prisma/dev.db` verified to contain seed admin `admin` / `admin123` (documented default — change via Settings → Admin Security).
- Package renamed `ai-studio-applet` → `tayyab-enterprises-management-system`.
- `git origin` now `beingadil/Laptop-Accessories-Shop`; original repo kept as `upstream`.
- `.gitignore`: added `dist-electron/`, `*.tsbuildinfo`, `prisma/*.db-shm`, `prisma/*.db-wal`.
- PRD preserved at `docs/PRD.md` (moved from AI Studio assets folder).

### Removed
- **All Google dependencies** (2026-11-16): `@google/genai`, `firebase-tools`, and their transitive Google Cloud/gRPC trees; `next/font/google` (app now uses offline system fonts: Segoe UI / Cascadia Mono); `picsum.photos` remote image placeholder; AI Studio `metadata.json`; AI Studio assets folder. The application now makes zero network calls at runtime (update check in Phase 8 will be the only exception).
- `GEMINI_API_KEY` from `.env.example` — no external API keys are required or used.
- `bun.lock` — pnpm is the sole package manager.
- `tsconfig.tsbuildinfo` from tracking.

### Fixed
- Windows `next build` standalone packaging: hoisted pnpm node-linker (EPERM symlink failures) and `outputFileTracingRoot` pinned to project root (stray home-directory `package.json` broke tracing).
- `pnpm-workspace.yaml` allowBuilds so Prisma/Tailwind postinstalls run under pnpm 11.

### Added
- `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/PERFORMANCE_AUDIT.md`, `docs/TECH_DEBT.md`, `docs/TESTING.md`, `ROADMAP.md`, `memory.md`.
- `.npmrc` (`node-linker=hoisted`).

## [0.1.0] - 2026-11 (inherited baseline)

- Initial AI-Studio-generated Next.js 15 app: laptop/accessories inventory with serialized tracking, sales/purchases/returns/warranties/expenses/reports, SQLite + Prisma, JWT admin
  session, Excel/PDF export, Electron wrapper with embedded Next standalone server, NSIS installer config, backup/restore.
