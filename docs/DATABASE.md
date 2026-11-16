# DATABASE.md — Persistence Model & Operations

**Engine:** SQLite via Prisma 6.19. **Mode:** WAL (`journal_mode=WAL`, set on bootstrap) with `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`.

## Where the database lives

| Environment | Path |
|---|---|
| Dev | `prisma/dev.db` (committed **as the first-run seed**, never live data) |
| Packaged app | `%APPDATA%/tayyab-enterprises-management-system/data/tayyab-enterprises.db` (Electron `userData`, created on first run by copying the bundled seed) |
| Test | `tests/integration/.tmp-integration.db` (created + deleted per run — never touches `dev.db`) |
| Backup (user) | Downloaded via Settings → Backup & Restore (checkpointed snapshot) |
| Pre-restore safety copy | `<db>.pre-restore.bak` next to the live DB |

## Seed & first run

1. Electron (`electron/main.js`) ensures `<userData>/data/` exists.
2. If `tayyab-enterprises.db` is absent, it copies the bundled `prisma/dev.db` (via `extraResources` → `resources/prisma/dev.db`).
3. `.auth-secret` (random 32-byte hex) is generated once next to it and reused — this is the JWT signing key for the packaged app.
4. On every startup the server runs `ensureDatabaseSeeded()` (idempotent): WAL pragmas, create default admin (`admin`/`admin123`) **only if none exists**, ensure `ShopSettings id=default` (shop name, phones), demo content only when tables are empty.
5. Fresh-install credentials are **admin / admin123** — change immediately via Settings → Admin Security.

## Migration strategy (v1.0.0 — explicit)

- Schema is applied with `prisma db push` during development. There is **no runtime migration runner in the app**.
- The seed `prisma/dev.db` is regenerated per release from the current schema and shipped as the fresh-install template.
- **Upgrades never ship the seed over an existing user database.** Existing installs keep their `%APPDATA%/...` DB.
- v1.0.0 limitation: schema changes between releases are not auto-applied to existing installs. v1.x policy: **additive-only schema changes** (new columns with defaults / new tables). The next schema rev must add a startup migration hook (`prisma migrate deploy` or an idempotent `migrate()` in bootstrap) — tracked in ROADMAP Phase 5.
- `AuditLog` rows are append-only; stock/finance invariants are guarded at the service layer (see TECH_DEBT).

## Transactions & integrity

- All multi-step writes (sale, purchase, return, exchange, delete/reverse) run inside `prisma.$transaction`.
- Document numbers (invoice/PO/return) are generated inside the transaction and retried on P2002 collision (`lib/services/tx-retry.ts`).
- Stock changes use **atomic guarded writes** (`updateMany WHERE currentStock >= qty`, conditional serial claim on `stockStatus='IN_STOCK'`) — no read-modify-write races.
- `PRAGMA quick_check` runs on every DB **restore**, with automatic rollback to `.pre-restore.bak` on failure.
- Backup download runs `PRAGMA wal_checkpoint(TRUNCATE)` first so the snapshot includes everything.

## Backup / restore contract

**Download (GET /api/backup):** full checkpointed DB to the client. Safe at any time; no data loss.
**Restore (POST /api/backup):** requires `confirmed=true`, `.db` file ≤ 250 MB, valid SQLite magic, and must contain this app's core tables (`Product`, `Sale`, `ShopSettings`, `AdminUser`, `StockMovement`). Current DB is snapshotted to `<db>.pre-restore.bak` (after WAL checkpoint), replaced, then `quick_check`-verified; any failure triggers **automatic rollback**. Restore ends with `resetSeedCache()` and asks the user to refresh.

Restore is available to the signed-in admin only. It is destructive to the live database — that is its purpose.

## Known debts (tracked in TECH_DEBT.md)

- `dev.db-wal`/`-shm` were committed at some point (now gitignored; WAL files untracked).
- No FK from `AuditLog` cleanup — logs grow unbounded (single-user shop scale; revisit with retention policy).
- Money stored as `Float` (IEEE-754) — acceptable for PKR retail to ₨0.01; integer minor units would be the rigorous fix (B11).
