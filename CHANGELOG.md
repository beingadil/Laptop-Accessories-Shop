# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Removed
- **All Google dependencies** (2026-11-16): `@google/genai`, `firebase-tools`, and their transitive Google Cloud/gRPC trees; `next/font/google` (app now uses offline system fonts: Segoe UI / Cascadia Mono); `picsum.photos` remote image placeholder; AI Studio `metadata.json`; AI Studio assets folder. The application now makes zero network calls at runtime (update check in Phase 8 will be the only exception).
- `GEMINI_API_KEY` from `.env.example` — no external API keys are required or used.
- `bun.lock` — pnpm is the sole package manager.
- `tsconfig.tsbuildinfo` from tracking.

### Fixed
- Windows `next build` standalone packaging: hoisted pnpm node-linker (EPERM symlink failures) and `outputFileTracingRoot` pinned to project root (stray home-directory `package.json` broke tracing).
- `pnpm-workspace.yaml` allowBuilds so Prisma/Tailwind postinstalls run under pnpm 11.

### Changed
- Package renamed `ai-studio-applet` → `tayyab-enterprises-management-system`.
- `git origin` now `beingadil/Laptop-Accessories-Shop`; original repo kept as `upstream`.
- `.gitignore`: added `dist-electron/`, `*.tsbuildinfo`, `prisma/*.db-shm`, `prisma/*.db-wal`.
- PRD preserved at `docs/PRD.md` (moved from AI Studio assets folder).

### Added
- `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/PERFORMANCE_AUDIT.md`, `docs/TECH_DEBT.md`, `docs/TESTING_STRATEGY.md`, `ROADMAP.md`, `memory.md`.
- `.npmrc` (`node-linker=hoisted`).

## [0.1.0] - 2026-11 (inherited baseline)

- Initial AI-Studio-generated Next.js 15 app: laptop/accessories inventory with serialized tracking, sales/purchases/returns/warranties/expenses/reports, SQLite + Prisma, JWT admin
  session, Excel/PDF export, Electron wrapper with embedded Next standalone server, NSIS installer config, backup/restore.
