# ROADMAP.md — Tayyab Enterprises Management System

Live phase tracker. Update after every completed/verified phase. Evidence or it isn't done.

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Architecture audit | ✅ Complete (awaiting review) | `docs/PROJECT_AUDIT.md`, `ARCHITECTURE.md`, `PERFORMANCE_AUDIT.md`, `TECH_DEBT.md`, `TESTING_STRATEGY.md` |
| 1 | Next.js performance optimization | 🟡 In progress | Google-dep removal + Windows build fixes pushed (4c49214); dynamic recharts, branding `cache()`, LOW_STOCK SQL, search cap, memoized DataTable pending |
| 2 | Code quality & refactor | ⏳ Pending | see fix order in `docs/TECH_DEBT.md` — auth realignment first (A1–A4) |
| 3 | Functional & regression testing | ⏳ Pending | `docs/TESTING_STRATEGY.md` ready; no runner installed yet |
| 4 | Electron compatibility | 🟡 Mostly pre-done | Electron shell exists (embedded standalone server, userData DB, IPC backup/print). Pending: security headers review, CSP, auto-updater hook, code signing decision |
| 5 | DB offline reliability | ⏳ Pending | Seed-in-userData implemented; still needs: migration story (db push → migrations), backup integrity check fix (A4), WAL checkpoint discipline, seed checkpoint not to ship .db-shm/.wal |
| 6 | Windows installer (NSIS) | ⏳ Pending | `electron-builder.json` exists; never built/tested; no icon yet; no signing |
| 7 | GitHub repo + CI/CD | 🟡 In progress | `origin` = `beingadil/Laptop-Accessories-Shop` (main pushes land here 2026-11-16); upstream kept as `upstream`. `.github/workflows/` NOT created yet |
| 8 | Automatic updates | ⏳ Pending | `electron-updater` not installed; update UX to build after Phase 6 |
| 9 | Release testing | ⏳ Pending | strategy §Release gate in TESTING_STRATEGY |
| 10 | Production release | ⏳ Pending | after 3, 5, 6, 7, 8, 9 |

## Ad-hoc work landed

| Date | Item |
|---|---|
| 2026-11-16 | Removed **all Google dependencies** (`@google/genai`, `firebase-tools`) + `next/font/google` (system stack) + AI Studio artifacts (`metadata.json`, aistudio assets — PRD preserved at `docs/PRD.md`) + `GEMINI_API_KEY` from env example. App is offline-pure. |
| 2026-11-16 | Fixed Windows standalone build: hoisted pnpm linker (`pnpm-workspace.yaml`), `outputFileTracingRoot` pinned to project (stray home-dir `package.json`); `.npmrc` added. |
| 2026-11-16 | Renamed repo home to `beingadil/Laptop-Accessories-Shop`; pnpm-lock committed; `tsconfig.tsbuildinfo` untracked; dist-electron gitignored. |

## Standing decisions

- pnpm is the package manager. **No bun, no npm locks.**
- Offline-first forever. New dependencies must justify network silence (none may phone home).
- `prisma/dev.db` remains the committed seed; live user data lives in `userData` and is never committed.
- Push target: `origin` (beingadil). `upstream` = original windowspeak10-blip source, read-only reference.
- **No release tags / no installer publish until Phase 3 CI is green.**
- Design is frozen — optimization must not redesign the UI (rule 14).

## Next actions (in order)

1. Phase 1 quick wins: `next/dynamic` for recharts; delete `middleware.ts`; React `cache()` for `getShopBranding`; drop layout `force-dynamic`; SQL-side LOW_STOCK; `products?all=1` lean mode; search parallel-flag reduction + client cache; memoize `DataTable`/columns.
2. Phase 2 security block: real `requireAuth()`, remove default `admin123` (or force-change on first login), AUTH_SECRET hard failure in prod, hardened restore (magic+schema check, size cap, working rollback), login throttle, refund caps, atomic stock SQL.
3. Phase 3: Vitest + RTL + Playwright wired; port 3 orphan tests; service integration tests on temp SQLite; CI workflow (lint→typecheck→test→build).
4. Phase 6: build NSIS installer locally; smoke-test install→create sale→backup→uninstall; icon + signing decision with user.
