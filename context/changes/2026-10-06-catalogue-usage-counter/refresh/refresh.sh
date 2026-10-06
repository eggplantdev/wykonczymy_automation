#!/usr/bin/env bash
# Re-measures the catalogue usage findings in ../change.md against a prod dump.
# Usage (repo root): bash context/changes/2026-10-06-catalogue-usage-counter/refresh/refresh.sh [dump.sql]
# Restores into a throwaway `dump_scratch` DB on the dev container — never touches `wykonczymy-db`.
set -euo pipefail

DUMP="${1:-dumps/dump-latest.sql}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d -t catalogue-usage)"
PSQL=(docker exec -i wykonczymy psql -U postgres)

"${PSQL[@]}" -q -c "DROP DATABASE IF EXISTS dump_scratch;" -c "CREATE DATABASE dump_scratch;"
"${PSQL[@]}" -d dump_scratch -q < "$DUMP" > /dev/null 2>&1 || true

clean="replace(replace(replace(%s, E'\\t', ' '), E'\\n', ' '), E'\\r', ' ')"
"${PSQL[@]}" -d dump_scratch -At -F $'\t' -c "
  SELECT id, match_key, $(printf "$clean" description), unit FROM work_catalogue_items" > "$OUT/cat.tsv"
"${PSQL[@]}" -d dump_scratch -At -F $'\t' -c "
  SELECT ki.investment_id,
         EXISTS (SELECT 1 FROM kosztoryses k WHERE k.investment_id = ki.investment_id),
         $(printf "$clean" ki.description), coalesce(ki.unit, ''), ki.planned_qty,
         coalesce((SELECT sum(qty_done) FROM stage_progress sp WHERE sp.item_id = ki.id AND sp.qty_done > 0), 0)
  FROM kosztorys_items ki JOIN investments i ON i.id = ki.investment_id
  WHERE i.status <> 'szablon' AND i.trashed_at IS NULL AND btrim(coalesce(ki.description, '')) <> ''" > "$OUT/items.tsv"

node --import tsx "$HERE/measure.ts" "$OUT" "$DUMP"
