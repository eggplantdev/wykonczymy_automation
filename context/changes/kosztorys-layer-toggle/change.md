---
change_id: kosztorys-layer-toggle
title: Work/progress column reading-axis toggle for the kosztorys v2 editor
status: implementing
created: 2026-07-16
updated: 2026-07-16
archived_at: null
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

Add a fourth column reading-axis to the kosztorys v2 editor: a "praca / postęp / oba"
(work / progress / both) toggle, modelled on the existing money-axis (netto/brutto/oba).

Progress columns are tagged **by identity** in a `COLUMN_LAYER` map — never split by grid
index — so reordered or newly-added columns still target correctly. A new column absent
from the map is neutral and shows in every mode until tagged.

Progress-tagged columns: `stageValueNet`, `stageValueGross`, `stageValuePercent`,
`donePercent`, `remaining`. Everything else (incl. `stageQtySum` / Pomiar z natury) is
neutral. Default axis: `both`.

Mirror the existing pattern exactly: `COLUMN_MONEY_AXIS` + `money-axis.ts` (`axisAllows`)
and `COLUMN_PROGRESS_DISPLAY` + `progress-display.ts` (`progressDisplayAllows`). New:
`COLUMN_LAYER` in constants + `layer.ts` (`layerAllows`), composed into the filter in
`buildV2Columns` alongside the other three axes, plus a UI toggle next to netto/brutto.
