# SECURITY.md — Security Posture

Reviewed 2026-11-16. Scope: desktop app (Electron main + preload) and the embedded Next.js server (loopback HTTP on 127.0.0.1 only).

## Threat model (single-user desktop, offline shop PC)

Attackers we realistically face: (1) a stranger at the counter with brief access to the machine, (2) a malicious/untrusted file fed to the restore feature, (3) the update channel being hijacked (supply chain). We do **not** defend against a fully privileged local OS account owner — no desktop app can.

## Authentication & session

- One local admin account (bcrypt, cost 10).
- Session = HS256 JWT (`jose`), 7-day expiry, `httpOnly` cookie `tayyab_admin_session` (`sameSite=lax`, `secure` only on HTTPS).
- **Every API route** enforces the session via `requireAuth()` (cookie verified, 401 JSON otherwise). **Pages** redirect to `/login` via `middleware.ts`. Verified end-to-end 2026-11-16.
- `AUTH_SECRET`: required in production (fail-fast if missing/<32 chars). Packaged app generates a random secret once and stores it in `userData/data/.auth-secret`. Dev uses a source-level fallback marked not-for-production.
- Login: dummy bcrypt comparison for unknown usernames (no timing oracle), 5 attempts / 5 minutes per client → 429. Password change: same throttle. Logout: cookie cleared; stateless JWT (old tokens valid until expiry — accepted single-user risk, documented).
- Fresh install seeds `admin` / `admin123` — **documented default; change via Settings → Admin Security**. Forced-change-on-first-login is queued (A2).

## Authorization

- Single role (admin). No RBAC — all signed-in actions are permitted. Deliberate for single-operator shop.
- No cross-tenant logic. Audit log attributes every write to the admin user.

## Input validation & output safety

- zod validates every body (unknown keys stripped); dates must parse; enum query params allow-listed; refund amounts capped to prorated paid totals; uploads size-capped (logo ~1.4 MB, backup 250 MB).
- DB restore: magic bytes + core-table check + `quick_check` + **automatic rollback** (see DATABASE.md).
- No raw SQL concatenation anywhere user-controlled. `$queryRawUnsafe` used only for static PRAGMAs/`SELECT 1`.
- XSS: React escapes all rendering; no `dangerouslySetInnerHTML` on user data; shop logo renders as `data:` URL `<img>` only.
- CSP: not deployed (Next 15 inline scripts need a nonced strategy — tracked). Mitigating headers are set: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `X-DNS-Prefetch-Control: off`.

## Electron hardening

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload uses `contextBridge` with an **allow-listed** API surface (print, backup save/pick, app info, updater). No `ipcRenderer` exposed raw; every IPC validates shape.
- `webContents.setWindowOpenHandler` forces external URLs to the system browser; `will-navigate` blocks navigation away from the app origin.
- Loopback-only server (`127.0.0.1`), random port per run; no remote content loaded; `file://` unused at runtime.

## Update channel (Phase 8)

- `electron-updater` + NSIS + GitHub Releases on `beingadil/Laptop-Accessories-Shop`.
- Update packages are the release assets electron-builder itself produced (integrity-verified via the SHA-512 blockmap/`latest.yml` manifest, which electron-updater validates before install).
- **No arbitrary URLs are ever downloaded/executed**; no `eval`; no dynamic code fetch.
- Windows code signing: **not yet applied** (SmartScreen will warn on first install). Needs a certificate (OV ~$80-120/yr or EV). Decision tracked in memory.md open questions.

## Secrets & data

- `.env` gitignored; `.env.example` holds placeholders only; no GEMINI/Google keys anywhere (dependency fully removed 2026-11-16 — lockfile verified clean).
- Shop DB contains customer phone numbers/addresses — treat backups accordingly (they are plain SQLite files; keep them private).
- Auth log/audit attributed to the single admin.

## Standing rules

1. Never commit `.env`, real AUTH_SECRETs, or the live `dev.db` (it holds the seed's default admin hash — it's the *seed*, scrub before shipping public releases if the shop's real data ever lands there).
2. Any new API route ships with `requireAuth()` + zod + size caps or it does not merge.
3. Any new IPC ships with an explicit allow-list entry + input validation.
4. Dependencies: every addition must justify its existence and be actively maintained; Google telemetry-adjacent SDKs are banned (offline app).
