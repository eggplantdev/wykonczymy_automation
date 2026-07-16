---
change_id: kosztorys-section-append
title: Append a section from a szablon into an existing kosztorys
status: implementing
created: 2026-07-16
updated: 2026-07-16
archived_at: null
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

append a section from a szablon into an existing kosztorys (section-granular read over the existing kosztorys_presets storage)

Shaping decisions (owner conversation, 2026-07-16):

- **Storage unchanged** — whole szablony in `kosztorys_presets`; sections live inside payloads. No new table, no migration.
- **Rejected: canonical/unique section names.** A global canonical section forces upsert semantics and a three-way conflict dialog on every save-as (new _and_ overwrite) — "this is bad" (owner). Duplicates across szablony are allowed; the picker labels each occurrence with its source szablon („Łazienka — Mieszkanie standard").
- **V1 scope: append-only.** One entry point in the editor: „Dodaj sekcję z szablonu" → union picker over all szablony's sections → appends the sekcja with its prace/ceny/coefficients, job-specific fields zeroed (przedmiar, rabat, postęp, note, hiddenInExport). Covers both à-la-carte composition (seed empty → append) and adding a section to a live kosztorys.
- **Out of scope:** seed-dialog section multi-select (cheap follow-up if needed); szablon-scoped „zapisz sekcję do szablonu" write-back (only if owner complains about manual forward-propagation); any write-side changes.
- **Engine note:** `applyPreset` (`src/lib/kosztorys/apply-preset.ts`) is insert-only but assumes an empty tree; append variant needs `display_order = max+1` and no stage handling (stages are investment-level, not section-level).
- Guiding constraint from the owner: **it must be simple.**
