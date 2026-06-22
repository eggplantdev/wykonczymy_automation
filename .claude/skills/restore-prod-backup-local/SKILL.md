---
name: restore-prod-backup-local
description: Restore the latest Neon production backup into the local Docker Postgres for this repo (wykonczymy), and/or check that the automated backup pipeline is healthy. The dumps live on an FTP server (188.210.222.1, /db_backups/) that GitHub Actions uploads to hourly (cron `0 4-22 * * *` = 04:00–22:00 UTC, with a ~6h overnight gap) — THIS skill is how you fetch data off that FTP server, so it is the answer to any "do you have a skill to get/pull the latest data from the FTP server?" question. Use whenever the user asks to "refresh the local DB from prod", "restore the latest backup locally", "populate local Docker from a backup", "pull down a prod dump", "get/pull/download the latest data or dump from the FTP server", "grab the newest backup off FTP", "fetch data from the backup FTP server", "check if backups are working", "is the db-backup GitHub Action green", or mentions anything about the Neon → GitHub Actions → FTP → local Docker backup chain. Trigger even if the user only says "FTP server", "the backup server", or "backup" loosely in the context of getting the local database's data — this skill owns the whole verify-and-restore flow end to end.
---

# Restore prod backup → local Docker Postgres

## What this is

A GitHub Actions workflow (`.github/workflows/db-backup.yml`) dumps the live Neon prod
DB hourly (cron `0 4-22 * * *` = 04:00–22:00 UTC; no run 22:00–04:00 UTC), validates it
(size / row floor / freshness / no-shrink), and uploads a
gzipped dump to an FTP server. This skill verifies that pipeline is healthy and restores
the newest dump into the **local** Docker Postgres so you can work against real data.

The chain: **Neon (prod) → GitHub Actions (hourly, 04:00–22:00 UTC) → FTP `188.210.222.1:/db_backups/` → local Docker `wykonczymy` container**.

## Hard safety rules

- **Never** touch the Neon prod DB. No SQL, dumps, restores, or migrations against
  `DB_POSTGRES_URL_PROD`. A PreToolUse hook blocks prod mutations — this skill only ever
  _reads_ prod indirectly (pulling a dump that GitHub Actions already made) and only ever
  _writes_ the local Docker container.
- The import **destroys whatever is in the local DB** (the dump uses `--clean --if-exists`,
  so every object is dropped and recreated). If the user may have entered data locally
  since the last refresh, confirm before importing.
- Never `git push`. Don't `git add` `src/payload-types.ts`.

## Prerequisites (all credentials are in `.env`)

`source .env` exposes everything needed — never hardcode these:

- `FTP` (host `188.210.222.1`), `FTP_USER`, `FTP_PASS` — FTP server. NOTE: the var is
  `FTP`, not `FTP_HOST` (the workflow uses an `FTP_HOST` _secret_; locally it's `FTP`).
- `DOCKER_CONTAINER` (`wykonczymy`), `POSTGRES_USER` (`postgres`), `POSTGRES_DB` (`wykonczymy-db`).
- `lftp` must be installed (`which lftp`; `brew install lftp` if missing).

## Procedure

Run these in order. Stop and report if any step fails — don't silently continue.

### 1. Verify the backup pipeline is healthy

```bash
gh run list --workflow=db-backup.yml --limit 12
```

Healthy looks like: recent runs all `success`, on the hourly cadence (`schedule`), most
recent within ~1h (during the 04:00–22:00 UTC window; expect up to a ~6h gap overnight).
If runs are failing or stale, **say so** — the local restore would pull
an old/bad dump. The workflow's own guards (`MIN_TX`, freshness, no-shrink) mean a _green_
run is a trustworthy dump.

### 2. Make sure Docker + the local container are up

```bash
docker info >/dev/null 2>&1 || open -a Docker   # start Docker Desktop if daemon is down
# then poll until ready:
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker compose up -d
```

### 3. List remote backups and pick the newest

Filenames are timestamped (`wykonczymy-backup-YYYYMMDD-HHMMSS.sql.gz`), so lexical sort ==
chronological. `lftp`'s own pipe parsing is unreliable — let the shell do `sort | tail`.

```bash
source .env
LFTP_OPTS="set ftp:ssl-auth TLS; set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate no; set xfer:clobber on;"
LATEST=$(lftp -c "$LFTP_OPTS open -u '$FTP_USER','$FTP_PASS' '$FTP'; cd /db_backups/; cls -1 *.sql.gz" 2>/dev/null | sort | tail -1)
echo "Latest backup: $LATEST"
```

### 4. Download it

```bash
mkdir -p dumps
lftp -c "$LFTP_OPTS open -u '$FTP_USER','$FTP_PASS' '$FTP'; cd /db_backups/; get '$LATEST' -o 'dumps/$LATEST'"
ls -lh "dumps/$LATEST"
```

### 5. Decompress and import into the local container

```bash
gzip -dkf "dumps/$LATEST"                       # -k keeps the .gz; produces dumps/<name>.sql
SQL="dumps/${LATEST%.gz}"
# wait for Postgres inside the container:
for i in $(seq 1 20); do docker exec "$DOCKER_CONTAINER" pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1 && break; sleep 1; done
docker exec -i "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SQL"
```

A successful import ends in a stream of `ALTER TABLE` / `CREATE INDEX` lines. `psql` without
`-v ON_ERROR_STOP=1` won't fail the shell on a single bad line, so don't trust the exit code —
verify with step 6.

> Alternative: `pnpm db:import` runs the same import but reads `dumps/dump-latest.sql` by
> default (or `DUMP_FILE=...`). The explicit `docker exec` above is clearer when targeting a
> specific timestamped dump.

### 6. Clean up old backup files

Delete `wykonczymy-backup-*` files (both `.gz` and decompressed `.sql`) in `dumps/` older than 7 days.

```bash
find dumps -maxdepth 1 -name 'wykonczymy-backup-*' -mtime +7 -delete
```

### 7. Verify the data landed (this is the real success check)

Cast counts to `text` — you can't `UNION` `bigint` with a timestamp.

```bash
docker exec -i "$DOCKER_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "
SELECT 'transactions',   count(*)::text FROM transactions
UNION ALL SELECT 'investments',    count(*)::text FROM investments
UNION ALL SELECT 'cash_registers', count(*)::text FROM cash_registers
UNION ALL SELECT 'users',          count(*)::text FROM users
UNION ALL SELECT 'latest tx created_at', max(created_at)::text FROM transactions;
"
```

Report back: the row counts, the latest `created_at` (should be within hours of the dump's
timestamp — proves it captured live prod, not a frozen copy), and confirm `transactions` is
comfortably above the workflow's `MIN_TX` floor.

## Reporting

Give the user a tight summary: pipeline status (last run + cadence), which dump was pulled,
the verified row counts, and the freshness timestamp. Flag explicitly if you overwrote a
non-empty local DB.
