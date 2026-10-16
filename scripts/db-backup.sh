#!/usr/bin/env bash
# Usage:
#   source .env && BACKUP_DB_URL="$DB_POSTGRES_URL_PROD" scripts/db-backup.sh
set -euo pipefail

: "${BACKUP_DB_URL:?set BACKUP_DB_URL to the Neon connection string}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:?set DOCKER_CONTAINER (the local postgres container)}"
OUT_DIR="${OUT_DIR:-dumps/test}"
MIN_TX="${MIN_TX:-1000}"
FRESH_DAYS="${FRESH_DAYS:-3}"
SIZE_FLOOR="${SIZE_FLOOR:-1024}"          # bytes, gzipped
KEY_TABLES="${KEY_TABLES:-transactions investments cash_registers users}"

mkdir -p "$OUT_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
NEW="$OUT_DIR/wykonczymy-backup-${ts}.sql.gz"

count_rows() { # <file> <table>
  local reader='cat'; [[ "$1" == *.gz ]] && reader='gzip -dc'
  $reader "$1" | awk -v tb="COPY public.$2 " '
    index($0, tb)==1 {f=1; next}
    f && $0=="\\." {f=0}
    f {n++}
    END {print n+0}'
}
fail() { echo "❌ $*" >&2; exit 1; }

echo "▶ dumping → $NEW"
docker exec -i "$DOCKER_CONTAINER" \
  pg_dump "$BACKUP_DB_URL" --no-owner --no-privileges --clean --if-exists \
  | gzip > "$NEW"

size=$(stat -f%z "$NEW" 2>/dev/null || stat -c%s "$NEW")
echo "📦 size: $size bytes"
(( size >= SIZE_FLOOR )) || fail "dump too small ($size < $SIZE_FLOOR) — likely empty/aborted"

tx=$(count_rows "$NEW" transactions)
echo "🔢 transactions rows: $tx"
(( tx >= MIN_TX )) || fail "transactions=$tx below floor $MIN_TX — wrong/empty DB?"

# the business `date` column can be future-dated and spoof it.
max_created=$(docker exec -i "$DOCKER_CONTAINER" psql "$BACKUP_DB_URL" -tAc \
  "SELECT max(created_at)::date FROM transactions" | tr -d '[:space:]')
echo "📅 latest created_at: ${max_created:-none}"
[[ -n "$max_created" ]] || fail "could not read max(created_at)"
cutoff=$(date -v-"${FRESH_DAYS}"d +%Y-%m-%d 2>/dev/null || date -d "-${FRESH_DAYS} days" +%Y-%m-%d)
[[ "$max_created" > "$cutoff" || "$max_created" == "$cutoff" ]] || \
  fail "latest created_at $max_created older than $cutoff (${FRESH_DAYS}d) — DB frozen?"

prev=$(ls -t "$OUT_DIR"/wykonczymy-backup-*.sql.gz 2>/dev/null | grep -v "$NEW" | head -1 || true)
if [[ -z "$prev" ]]; then
  echo "ℹ️  no previous dump to compare — establishing baseline"
else
  echo "🔁 comparing row counts vs $(basename "$prev")"
  drift=0
  for t in $KEY_TABLES; do
    new_c=$(count_rows "$NEW" "$t"); old_c=$(count_rows "$prev" "$t")
    delta=$(( new_c - old_c ))
    printf '   %-18s prev=%-6s new=%-6s Δ=%+d\n' "$t" "$old_c" "$new_c" "$delta"
    (( new_c < old_c )) && { echo "   ↳ ❌ $t shrank ($old_c → $new_c)"; drift=1; }
  done
  (( drift == 0 )) || fail "a key table shrank vs previous dump — investigate before trusting this backup"
fi

echo "✅ backup validated: $NEW"
