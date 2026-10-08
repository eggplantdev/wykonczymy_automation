#!/usr/bin/env bash
# Exports one szablon and the katalog prac from two prod dumps — the state before the kierownik's
# edits (BASE) and now (NOW) — for diff.ts's three-way comparison.
# Usage (repo root): [TEMPLATE='Kosztorys 2026 kolory'] bash …/sync/export.sh BASE.sql NOW.sql OUT_DIR
# Restores into throwaway `tpl_base` / `tpl_now` DBs on the dev container — never touches
# `wykonczymy-db` or Neon.
set -euo pipefail

BASE_DUMP="$1"
NOW_DUMP="$2"
OUT="$3"
TEMPLATE="${TEMPLATE:-Kosztorys 2026 kolory}"
PSQL=(docker exec -i wykonczymy psql -U postgres)
mkdir -p "$OUT"

export_side() {
  local db="$1" dump="$2" side="$3"
  "${PSQL[@]}" -q -c "DROP DATABASE IF EXISTS $db;" -c "CREATE DATABASE $db;"
  "${PSQL[@]}" -d "$db" -q < "$dump" > /dev/null 2>&1 || true

  "${PSQL[@]}" -d "$db" -At -v template="$TEMPLATE" <<'SQL' > "$OUT/$side-template.json"
    SELECT coalesce(json_agg(t ORDER BY t.section_order, t.display_order), '[]') FROM (
      SELECT ki.id, s.name AS section_name, s.display_order AS section_order, ki.display_order,
             ki.description, coalesce(ki.unit, '') AS unit, ki.client_price,
             ki.w_tools_override_value, ki.own_tools_override_value,
             ki.w_tools_override_coeff, ki.own_tools_override_coeff,
             ki.description_translations, ki.updated_at
      FROM kosztorys_items ki
      JOIN kosztorys_sections s ON s.id = ki.section_id
      JOIN investments i ON i.id = ki.investment_id
      WHERE i.status = 'szablon' AND i.name = :'template' AND btrim(coalesce(ki.description, '')) <> ''
    ) t
SQL

  # Whole rows: the BASE dump may predate a column (work_note landed 2026-10-07).
  "${PSQL[@]}" -d "$db" -At -c "
    SELECT coalesce(json_agg(c ORDER BY c.id), '[]') FROM work_catalogue_items c" > "$OUT/$side-catalogue.json"
}

export_side tpl_base "$BASE_DUMP" base
export_side tpl_now "$NOW_DUMP" now

for side in base now; do
  node -e "
    const template = require('$OUT/$side-template.json')
    const catalogue = require('$OUT/$side-catalogue.json')
    const lastEdit = template.map((row) => row.updated_at).sort().at(-1)
    console.error('$side: ' + template.length + ' prac szablonu, ' + catalogue.length + ' wpisów katalogu, ostatnia zmiana w szablonie ' + lastEdit)"
done
