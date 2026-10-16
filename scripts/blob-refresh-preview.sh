#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
source .env
[ -f .env.local ] && source .env.local
set +a

CACHE_DIR="${BLOB_MIRROR_DIR:-dumps/blob-mirror}"
REMOTE_MEDIA="${REMOTE_MEDIA_DIR:-/blob_backups/media/}"
HOST="${FTP_HOST:-${FTP:-}}"

: "${HOST:?FTP host missing — set FTP (or FTP_HOST) in .env}"
: "${FTP_USER:?FTP_USER missing in .env}"
: "${FTP_PASS:?FTP_PASS missing in .env}"
: "${BLOB_READ_WRITE_TOKEN:?BLOB_READ_WRITE_TOKEN missing in .env}"

for opt in "$@"; do
  if [ "$opt" = "--allow-prod" ]; then
    echo "✗ --allow-prod is not accepted here — use scripts/blob-restore.mjs directly" >&2
    exit 1
  fi
  # blob-restore's arg() takes the FIRST match, and this wrapper passes --limit ahead of "$@",
  # so a caller's --limit would be silently ignored and the cap used instead.
  if [ "$opt" = "--limit" ]; then
    echo "✗ --limit is set by this wrapper — use BLOB_REFRESH_MAX=<n> instead" >&2
    exit 1
  fi
done

mkdir -p "$CACHE_DIR"

echo "→ pulling ${REMOTE_MEDIA} into ${CACHE_DIR} (delta only)"
# The password goes through LFTP_PASSWORD, never into the command string: lftp reads `user,pass`
# comma-separated, so a comma in the password truncates it and a quote escapes into lftp commands.
LFTP_PASSWORD="$FTP_PASS" lftp -c "
  set ftp:ssl-auth TLS; set ftp:ssl-force true; set ftp:ssl-protect-data true;
  set ssl:verify-certificate no; set ftp:passive-mode on;
  open --env-password -u \"${FTP_USER}\" \"${HOST}\";
  lcd \"${CACHE_DIR}\";
  mirror --no-perms --only-missing \"${REMOTE_MEDIA}\" .;
  bye
"

# lftp is unreliable about propagating a failure exit code out of `-c`, so `set -e` alone would let
# a failed auth fall through to an upload of nothing and print a clean OK — indistinguishable from
# a healthy no-op run.
MIRRORED=$(find "$CACHE_DIR" -type f | wc -l | tr -d ' ')
if [ "$MIRRORED" -eq 0 ]; then
  echo "✗ mirror produced no files — check the FTP credentials and ${REMOTE_MEDIA}" >&2
  exit 1
fi
echo "  ${MIRRORED} files in the local mirror"

MAX_UPLOADS="${BLOB_REFRESH_MAX:-500}"
echo "→ uploading what the preview store is missing (at most ${MAX_UPLOADS} this run)"
echo "  more than that? re-run — --skip-existing resumes; raise with BLOB_REFRESH_MAX=<n>"

node scripts/blob-restore.mjs --dir "$CACHE_DIR" --skip-existing --limit "$MAX_UPLOADS" "$@"
