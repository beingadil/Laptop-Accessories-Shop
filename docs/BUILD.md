# BUILD.md — Build & Packaging Guide

## Prerequisites

- Windows 10/11 x64 (primary), Node.js ≥ 22 (developed on 26), **pnpm 11** (`npm install -g pnpm`)
- `pnpm install` once — it also runs `prisma generate`
- A local `.env` for dev builds (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`) — see `.env.example`

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Hygiene gates (or `pnpm ci` = all + build) |
| `pnpm build` | Next.js **standalone** production build into `.next/standalone/server.js` |
| `pnpm start` | Serve the production build (⚠️ warns re: standalone; use for local verification only) |
| `pnpm electron:dev` | Electron with `ELECTRON_DEV=1` (loads dev server :3000) |
| `pnpm dist:win` | Build + NSIS installer into `dist-electron/` |
| `pnpm exec electron-builder --win --config electron-builder.json --publish never` | What `dist:win` runs |

## The two Windows packaging fixes (do not "simplify" these away)

1. **Hoisted node_modules** — `pnpm-workspace.yaml` sets `nodeLinker: hoisted`. The default symlinked `.pnpm` store makes Next's standalone file tracer fail with `EPERM: operation not permitted, symlink` on Windows.
2. **`outputFileTracingRoot`** — `next.config.ts` pins the tracing root to the project dir. A stray `package.json` in a parent folder (ours: the user's home directory) otherwise re-roots tracing and nests the output as `standalone/Desktop/LAPTOP MANAGEMENT SYSTEM/...`.

Also: pnpm 11 ignores `node-linker` in `.npmrc` (settings live in `pnpm-workspace.yaml`), and blocks dependency build scripts by default — `allowBuilds` in `pnpm-workspace.yaml` opts `prisma`/`@prisma/engines`/`@tailwindcss/oxide`/`electron` in and `core-js`/`electron-winstaller` out.

## Installer internals

- `electron-builder.json`: appId `com.tayyabenterprises.management`, productName, `artifactName: Tayyab-Enterprises-Management-System-Setup-<version>.<ext>` (matches `latest.yml` — required by the updater).
- `extraResources`: `.next/standalone` → `resources/standalone` (the embedded server), `.next/static` + `public` merged in, `prisma/dev.db` → `resources/prisma/dev.db` (first-run seed).
- NSIS: per-user install (`perMachine: false`), directory selectable, desktop + start-menu shortcuts (`createDesktopShortcut`, `createStartMenuShortcut`), upgrades preserve it by installing to the same dir.
- **Update identity**: `latest.yml` (SHA-512, URL) is generated on every build; the app reads update availability from the `beingadil/Laptop-Accessories-Shop` GitHub Release matching that manifest.

## Verified install cycle (2026-11-16, Windows 11)

Built `Tayyab Enterprises Management System Setup 0.1.0.exe` (~251 MB): unpacked binary launches and seeds `%APPDATA%/tayyab-enterprises-management-system/data/tayyab-enterprises.db`; silent install (`/S`) into `%LOCALAPPDATA%/Programs/...` works; installed app launches; silent uninstall removes the app folder **and leaves the userData database untouched**.

## Gotchas

- Don't `rm -rf node_modules` casually on throttled networks — reinstall with `pnpm_config_network_concurrency=1` and be patient; the store is content-addressed so most packages relink for free.
- First `next build` after dep changes: expect ~90 s. Incremental builds reuse `.next/cache`.
- `electron/dist` is required for `electron .` — it downloads via `node node_modules/electron/install.js` if missing.
- Keep `prisma/dev.db-shm`/`-wal` out of git (gitignored). A live WAL next to a committed DB corrupts fresh checkouts.
- The `.next` cache from different Electron/Node versions is not portable — always build on the target toolchain.
