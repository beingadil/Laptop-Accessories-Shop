# RELEASE.md — Release Process & Gate

Channels: **Development** (main branch, untagged) → **Beta** (`v1.1.0-beta.1` style tags) → **Stable** (`v1.0.0` tags). CI must be green on the tag's commit before the release job starts.

## Automated pipeline (`.github/workflows/release.yml`)

Trigger: push of a tag `v*.*.*`. Steps: tag/version match check → pnpm install (frozen) → **full gate** (`pnpm ci` = lint + typecheck + tests + Next build) → `electron-builder --publish always` → installer + `latest.yml` attached to the GitHub Release → artifact retained as workflow backup.

Publication uses the repository-scoped `GITHUB_TOKEN` (`contents: write`) — no separate credentials, nothing in source.

## Manual release runbook

1. **Freeze.** `git log origin/main..HEAD` empty; CI green on `main`.
2. **Version.** Bump `package.json` version (SemVer). `electron-builder` takes it from there. Update `CHANGELOG.md` (move Unreleased → versioned section, date it). Update `ROADMAP.md` status.
3. **Verify gates locally.** `pnpm ci` green; installer built locally (`pnpm dist:win`) and install/uninstall cycle passes (see BUILD.md §Verified).
4. **Commit.** `git commit -m "chore(release): v1.0.0"` on `main`, push, **wait for CI green**.
5. **Tag.** `git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0` — this *publishes*.
6. **Watch** Actions → Release job. Verify the Release exists with `*.exe` + `latest.yml`.

## Release gate (must all pass — `release.yml` enforces)

| Check | Where |
|---|---|
| Lint clean (0 errors) | `pnpm lint` |
| Types clean | `pnpm typecheck` |
| Unit + integration tests green | `pnpm test` |
| Production build succeeds | `pnpm build` |
| Tag matches `package.json` version | release.yml step 1 |
| Tag commit CI green | release.yml triggers on tag but gate re-runs everything |

## What is NOT yet automated (honest gaps)

- **Clean-machine install tests on Win10/Win11 VMs** — the matrix (fresh install, upgrade over 0.9.x, uninstall, reinstall, offline start) is manual; see §Acceptance checklist.
- **Update-from-previous-version test** — requires v1.0.0 released, v1.0.1 tagged, then an installed 1.0.0 checking for updates. Manual.
- **Code signing** — unsigned; SmartScreen warns. Obtain OV certificate or EV (HSM/token) — see SECURITY.md.
- **Crash reporting** — none (shop PC is the crash report; consider a opt-in `electron-log` file in v1.1).
- **Auto-update rollback** — electron-updater does not roll back; keep last-known-good installer available on the release page.

## Acceptance checklist (manual, before promoting Beta → Stable)

Environment: clean Windows 10 AND Windows 11 (VMs or spare PCs).

1. Fresh install from `Setup.exe`; desktop + start-menu shortcuts created.
2. First launch → login `admin`/`admin123` → change password → create a sale (1 serialized laptop + 1 accessory) → invoice prints / PDF downloads.
3. Stock reduced correctly; dashboard numbers consistent; backup downloads.
4. Restore the backup after adding a dummy product — data returns.
5. Uninstall → app removed; **shop database still exists in `%APPDATA%`**.
6. Reinstall → data recovered (products/sales intact).
7. Offline: disable network, launch → app works fully (login, sales, backup all fine) except the update check (which reports the offline error gracefully).
8. Upgrade path: install 1.0.0, add records, install 1.0.1 over it → records still present, app launches, version shows 1.0.1.
9. Sign the installer (when certificate available) and verify SmartScreen reputation builds.

## Release notes template

```
## v1.0.0 — 2026-11-16
First production release. ...
### Fixes
### Added
### Known issues
```
