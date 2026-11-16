# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
- `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/PERFORMANCE_AUDIT.md`, `docs/TECH_DEBT.md`, `docs/TESTING_STRATEGY.md`, `ROADMAP.md`, `memory.md`.
- `.npmrc` (`node-linker=hoisted`).

## [0.1.0] - 2026-11 (inherited baseline)

- Initial AI-Studio-generated Next.js 15 app: laptop/accessories inventory with serialized tracking, sales/purchases/returns/warranties/expenses/reports, SQLite + Prisma, JWT admin
  session, Excel/PDF export, Electron wrapper with embedded Next standalone server, NSIS installer config, backup/restore.
