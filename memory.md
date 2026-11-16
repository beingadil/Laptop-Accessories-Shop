# memory.md — Working Memory & Architectural Decisions

Purpose: keep long-horizon context alive across sessions. Append, don't rewrite history.

## 2026-11-16 — Session bootstrap

- Repo was `windowspeak10-blip/LAPTOP-MANAGEMENT-SOFTWARE` (a Next.js app scaffolded by Google AI Studio, partially Electron-wrapped). Cloned into empty Desktop folder "LAPTOP MANAGEMENT SYSTEM".
- **Repo home moved to `beingadil/Laptop-Accessories-Shop`** ("our main repo will be beingadil every push will be on it"). `origin` now points there; `upstream` keeps the original for reference. Branch = `main`.
- User's hard constraint: **fully offline desktop application — zero Google dependencies of any kind.** Executed 2026-11-16: @google/genai, firebase-tools, next/font/google (→ system font stack: Segoe UI / Cascadia Mono), picsum.photos placeholder host, GEMINI_API_KEY/AI Studio naming. Verified: lockfile contains no google/firebase/grpc/protobufjs strings; app has no runtime network calls.
- PRD discovered embedded as extensionless file `public/assets/aistudio/Paste_November_15__2026_-_6_26PM_ba463c55` (actually markdown PRD). Moved verbatim to `docs/PRD.md`. Do not re-create public/assets/aistudio.
- Package renamed `ai-studio-applet` → `tayyab-enterprises-management-system`.
- **pnpm is the only package manager** (bun.lock deleted; bun not installed on this machine). pnpm 11: build scripts are opt-in via `pnpm-workspace.yaml allowBuilds` (auto-scaffolded on first install; we maintain it by hand: prisma/@prisma/engines/@tailwindcss/oxide = true, core-js = false).
- **Windows + pnpm + Next standalone was broken two ways**: (1) symlinked `.pnpm` store → EPERM on `.next/standalone` copy → fix `nodeLinker: hoisted` in `pnpm-workspace.yaml` (`.npmrc` alone was ignored by pnpm 11). (2) stray `C:\Users\ADIL SHAHZAD\package.json` made Next trace files from the home dir → fix `outputFileTracingRoot: path.resolve(process.cwd())` in `next.config.ts`. Symptom was `standalone/Desktop/LAPTOP MANAGEMENT SYSTEM/...` nesting.
- `.next/standalone/server.js` now builds; `electron/main.js` expects exactly that path.
- `prisma/dev.db` is intentionally committed — it is the **first-run seed** copied to `%APPDATA%/…/userData/data/tayyab-enterprises.db` by Electron. Live DB is never in the repo. Committed `.db-shm/.db-wal` files are live WAL artifacts — untrack pending (checkpoint first), tracked in TECH_DEBT §E.
- `.env` exists locally (gitignored) with a freshly generated AUTH_SECRET for dev builds. Do not commit. Real AUTH_SECRET for packaged app is generated+ persisted in userData by Electron.
- Build verified 2026-11-16 after changes: `pnpm build` ✅, route table printed, shared First Load JS 103 kB.
- Commit 4c49214 pushed to origin/main.

## Decisions (standing)

- **Do not redesign the UI** (user rule 14). Perf work must not alter visuals.
- **No release/installer/tag until Phase 3 CI gates pass** (user rules 9, 13).
- Audit severity order — **auth first, always** (see TECH_DEBT fix order). Nothing ships with decorative auth.
- Prefer SQL-side filtering over JS fetch-all (SQLite column-vs-column needs `$queryRaw` or a stored flag — decide per site).
- `Float` money: migrate to integer minor units only if a full migration pass is scheduled; until then, keep behavior, add caps/guards (B11 ⚪).
- Electron packaging target: local machine build first; GitHub Actions runner second. Code signing: undecided — needs user decision (cert cost vs. SmartScreen warnings).
- electron-updater channel: GitHub Releases on `beingadil/Laptop-Accessories-Shop`; no separate release repo unless user asks.

## Session state / gotchas

- Git push over HTTPS worked via Windows Git Credential Manager (beingadil token cached). gh CLI not installed → no gh.
- pnpm 11 ignores `.npmrc` for install-time linker selection; use `pnpm-workspace.yaml`.
- pnpm rewrites `pnpm-workspace.yaml` scaffold placeholders if builds are pending — keep it committed & consistent.
- PowerShell treats git's stderr progress as errors (clone/push "failures" are cosmetic — verify with `git log`/`git status`).
- Subagent audit output key corrections pending verification during fixes: (a) `/api/auth/session` behavior, (b) exact LOW_STOCK code spans, (c) report route line numbers.

## Open questions for user

1. NSIS code signing certificate — buy one, or ship unsigned (SmartScreen "unknown publisher")? Affects release workflow & docs.
2. App icon — do you have a .ico / logo (the settings-uploadable logo could be rasterized)? Needed for installer quality.
3. Default admin: keep `admin/admin123` but force password change on first login, or blank-seed + first-run setup screen? (A2)
4. Release cadence — lock v1.0.0 scope to current feature set (inventory+sales+purchases+returns+reports), everything else v1.1+?

## 2026-11-16 (later) - Full phase run to 1.0.0
- User directive: continue all phases one by one; no per-phase commits - ONE final commit before push; before that final commit, verify the GitHub CI flow works (fast) from a fresh clone.
- Phases 0-10 executed. Headline: Google deps removed; real auth end-to-end; atomic stock writes (B1/B2); refund caps (A5); login/password throttle (A6); security headers (A8); date/enum/TZ validation (B8/B9/B10); restore hardening with auto-rollback; node --test infra (27 tests green, zero new runtime deps); Electron verified packaged; NSIS installer built + silent install/uninstall verified; workflows ci.yml/release.yml/security.yml written; electron-updater wired (Settings - Updates tab).
- Fresh-clone check: local clone + pnpm ci green before final commit.
- electron-builder.json artifactName fixed to match latest.yml (else updater 404s).
- .npmrc is machine-local + gitignored; use pnpm_config_network_concurrency=1 when the registry throttles (parallel fetches keep dying; serial works).
- electron dist binary missing? 
ode node_modules/electron/install.js.
- Restart preview servers after every rebuild (chunk hashes change under a running server).
- v1.0.1 queued: migration runner, B3 conditional increment, A2 forced pw change, icon/signing, loading/error boundaries, B3 leftovers.

## Resolved answers (user 2026-11-16)
- Main repo = beingadil/Laptop-Accessories-Shop; every push lands there.
- All Google deps must go (offline app) - done and verified in lockfile.
