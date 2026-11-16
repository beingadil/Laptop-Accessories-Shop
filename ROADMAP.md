# ROADMAP.md — Laptop Management System

Live phase tracker. Evidence or it isn't done.

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Architecture audit | ✅ Complete | docs/PROJECT_AUDIT, ARCHITECTURE, PERFORMANCE_AUDIT, TECH_DEBT, TESTING |
| 1 | Next.js performance optimization | ✅ Complete | recharts split (`/` first load 132 kB), `getShopBranding` React `cache()`, dead `motion` dep removed, headers added. (Deferred items noted in PERFORMANCE_AUDIT §5 / memory.md) |
| 2 | Code quality & refactor | ✅ Critical block complete | Auth realignment (A1/A3/A4/A10), restore hardening, refund caps (A5), rate limits (A6), atomic stock (B1/B2), numbering retry (B4), date/enum/TZ validation (B8/B9/B10), `.strict()` deferred (A9), over-return (B3) pending |
| 3 | Functional & regression testing | ✅ Complete (foundation) | `node --test`: 27 tests green. Integration suite guards audit bug classes. `pnpm ci` gate. RTL/Playwright deferred to v1.1 |
| 4 | Electron compatibility | ✅ Complete | embedded standalone server (verified packaged launch), contextIsolation/sandbox/preload allow-list, `will-navigate` guard added, CSP deferred |
| 5 | DB offline reliability | ✅ Complete (with v1 limits) | userData DB + seed copy, WAL pragmas, backup/restore with quick_check + auto-rollback, docs/DATABASE.md. Runtime migration runner planned for v1.1 |
| 6 | Windows installer (NSIS) | ✅ Complete | Installed and verified install→launch→uninstall cycle on Windows 11 (BUILD.md). Icon + code signing pending (user decision) |
| 7 | GitHub repo + CI/CD | ✅ Complete | `origin` = beingadil/Laptop-Accessories-Shop; `.github/workflows/ci.yml` (fast, cached), `release.yml` (tag → gate → publish), `security.yml` |
| 8 | Automatic updates | ✅ Complete (needs first release to prove) | electron-updater wired; Settings → Updates tab (check/download/install, progress, version); `latest.yml` generated per build; GitHub Releases feed |
| 9 | Release testing | 🟡 Partial | CI gate enforced; manual Windows QA checklist documented in RELEASE.md. Full VM matrix + update-from-1.0.0 test needs a released v1.0.0 — queued as the first post-release task |
| 10 | Production release | 🟡 Ready — awaiting user go | v1.0.0 bumped; changelog written; installer built & verified. Tag `v1.0.0` publishes via release.yml (needs user confirmation) |

## Ad-hoc work landed

| Date | Item |
|---|---|
| 2026-11-16 | **All Google dependencies removed** (offline-purity). |
| 2026-11-16 | Windows standalone build fixed (hoisted linker, tracing root). pnpm 11 `allowBuilds` in `pnpm-workspace.yaml`. |
| 2026-11-16 | Real auth enforced; sign-out added; seed credentials documented (admin/admin123). |
| 2026-11-16 | Test infrastructure from zero; 27 tests; service-level integration tests against temp SQLite. |
| 2026-11-16 | electron + electron-builder + electron-updater added; NSIS installer verified end-to-end. |
| 2026-11-16 | Version **1.0.0/1.0.1** set (1.0.1 = startup fix + audit); `docs/` filled out (DATABASE, SECURITY, BUILD, RELEASE). |

## Standing decisions

- **pnpm only** (nodeLinker hoisted); no bun/npm locks; `.npmrc` is machine-local and gitignored (fetch tuning), network serial fetch when throttled.
- Offline-first forever. Only intended network calls: GitHub Releases update checks (packaged app).
- `prisma/dev.db` = first-run seed; live DBs never committed.
- Design frozen; optimization did not redesign the UI.
- `admin`/`admin123` = seed default; change on first login (A2 forced-change tracked).
- v1.x schema changes are additive-only until a startup migration runner lands.

## Next actions (in order)

1. User decision: push `v1.0.0` tag (publishes Release + installer via Actions)?
2. User decision: app icon + code-signing certificate (unsigned ships with SmartScreen warning).
3. v1.0.1 (small): migration runner + B3 conditional increment + `loading.tsx`/`error.tsx` boundaries + A2 forced password change + icon + signing.
4. Phase 9 full release-test matrix (Win10/11 VMs) once v1.0.0 is out.
