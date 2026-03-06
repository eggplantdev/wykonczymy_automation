# Neon DB Backup Strategy — Implementation Plan

> **For Claude:** This is an infrastructure plan executed via SSH on an external server, not a codebase change.

**Goal:** Automated daily pg_dump backups of the Neon production database, stored on the SEO host server with 30-day retention.

**Problem:** Neon's 3-tier plan only offers a 6-hour rollback window — insufficient for disaster recovery.

**Architecture:** Cron job on SEO host runs `pg_dump` against Neon via connection string, compresses output, rotates old backups. No application code changes needed.

---

## Phase 1: Verify Connectivity from SEO Host

### Task 1: Check available tooling

SSH into the SEO host and check what's available.

**Step 1: Check for psql/pg_dump**

```bash
ssh user@seohost
psql --version
pg_dump --version
```

Expected: PostgreSQL client tools version 14+ (ideally 17 to match Neon).

**Step 2: If not installed, check if you can install**

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install postgresql-client-17

# If no sudo — check if there's a pre-installed version
which pg_dump
find /usr -name "pg_dump" 2>/dev/null
```

If no `pg_dump` and no `sudo`: **STOP** — this server won't work. Jump to Fallback section.

### Task 2: Test outbound connectivity to Neon

**Step 1: Test port 5432 reachability**

```bash
nc -zv ep-XXXXX.eu-central-1.aws.neon.tech 5432
```

Expected: `Connection succeeded` or `open`.

If blocked: **STOP** — outbound 5432 is firewalled. Jump to Fallback section.

**Step 2: Test actual psql connection**

```bash
psql "postgresql://USER:PASSWORD@ep-XXXXX.eu-central-1.aws.neon.tech/wykonczymy?sslmode=require" -c "SELECT current_database(), current_timestamp;"
```

Expected: Returns `wykonczymy` and current timestamp.

**Step 3: Test pg_dump**

```bash
pg_dump "postgresql://USER:PASSWORD@ep-XXXXX.eu-central-1.aws.neon.tech/wykonczymy?sslmode=require" --no-owner --no-privileges | head -20
```

Expected: SQL output starting with `--` comments and `SET` statements.

---

## Phase 2: Set Up Backup Script

### Task 3: Create directory structure and store credentials

**Step 1: Create backup directory**

```bash
mkdir -p ~/backups/wykonczymy
```

**Step 2: Store connection string securely**

```bash
echo "postgresql://USER:PASSWORD@ep-XXXXX.eu-central-1.aws.neon.tech/wykonczymy?sslmode=require" > ~/.neon_db_url
chmod 600 ~/.neon_db_url
```

Verify: `cat ~/.neon_db_url` shows the connection string, `ls -la ~/.neon_db_url` shows `-rw-------`.

### Task 4: Create the backup script

**Step 1: Write the script**

```bash
cat > ~/backup-neon.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

DB_URL=$(cat ~/.neon_db_url)
BACKUP_DIR="$HOME/backups/wykonczymy"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="wykonczymy_${TIMESTAMP}.sql.gz"
KEEP_DAYS=30

pg_dump "$DB_URL" --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${FILENAME}"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${KEEP_DAYS} -delete

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] OK: ${FILENAME} (${SIZE})"
SCRIPT

chmod +x ~/backup-neon.sh
```

**Step 2: Run it manually and verify**

```bash
./backup-neon.sh
```

Expected: Output like `[Tue Mar 4 12:00:00 UTC 2026] OK: wykonczymy_20260304_120000.sql.gz (2.1M)`

**Step 3: Verify the dump is valid**

```bash
gunzip -c ~/backups/wykonczymy/wykonczymy_*.sql.gz | head -30
```

Expected: Valid SQL (CREATE TABLE, etc.).

---

## Phase 3: Schedule Cron Job

### Task 5: Add cron entry

**Step 1: Edit crontab**

```bash
crontab -e
```

Add this line (runs daily at 3:00 AM server time):

```
0 3 * * * /home/YOURUSER/backup-neon.sh >> /home/YOURUSER/backups/backup.log 2>&1
```

**Step 2: Verify cron is registered**

```bash
crontab -l
```

Expected: Shows the backup line.

**Step 3: Wait for first automated run, then check**

After 3 AM, verify:

```bash
tail -5 ~/backups/backup.log
ls -lh ~/backups/wykonczymy/
```

Expected: New `.sql.gz` file from the scheduled time.

---

## Restore Procedure

To restore to any Postgres instance:

```bash
gunzip -c ~/backups/wykonczymy/wykonczymy_YYYYMMDD_HHMMSS.sql.gz | psql "$TARGET_DB_URL"
```

To restore to local dev:

```bash
gunzip -c ~/backups/wykonczymy/wykonczymy_YYYYMMDD_HHMMSS.sql.gz | psql "postgresql://postgres:postgres@localhost:5433/wykonczymy"
```

---

## Fallback: If SEO Host Can't Connect

If port 5432 is blocked or `pg_dump` can't be installed:

1. **GitHub Actions cron** — free, runs daily, dump to artifact or push to a storage bucket
2. **Small VPS** (Hetzner €3.5/mo) — full control, no restrictions
3. **Neon logical replication** — replicate to a second Neon project (more complex, higher tier needed)

Recommended fallback: GitHub Actions — zero cost, no server maintenance.
