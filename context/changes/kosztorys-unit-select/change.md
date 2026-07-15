---
change_id: kosztorys-unit-select
title: Kosztorys j.m. column — free text to open combobox
status: new
created: 2026-07-15
updated: 2026-07-15
archived_at: null
branch: null
worktree: null
---

## Notes

Convert the kosztorys editor `j.m.` (unit) grid column from free text to an open combobox: 5 canonical suggestions (m², szt, mb, kpl, pkt, normalising m2→m²) while still allowing a custom typed value. UI-only, unit is a non-computational label so no migration/calc impact.

Evidence for the canonical set — distinct units in `Kosztory testy wzór z danymi .csv` (463 rows): szt 110, m2 107, mb 70, kpl 63, pkt 13 (~97% of data), plus typos/noise the free-text column let through: klp 8 (→kpl), szt. 2 (→szt), j.m. 1, kontener 1. `kontener` is why the combobox stays **open**, not a locked select.

Existing primitive: `cell-select-menu.tsx` (discount-type / subcontractor-mode) — needs an editable/custom-entry variant.
