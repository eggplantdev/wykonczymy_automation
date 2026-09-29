---
change_id: ex-560-reload-from-preset
title: Reload a kosztorys from a preset onto a non-empty investment, reversibly
status: archived
created: 2026-08-12
updated: 2026-08-12
archived_at: 2026-08-12T11:08:59Z
branch: konradantonik/ex-560-przeladuj-z-szablonu
worktree: null
---

## Notes

„Przeładuj z szablonu" (reload from preset) onto a non-empty investment: a snapshot before the
wipe, atomic, reversible via the existing restore.

Owner ruling (2026-08-12, EX-560): the preset stays a **separate fast path** next to the sheet
import — the case is a fresh investment where a little was entered by hand and the owner wants to
start over without setting up a sheet. Fully reversible via the forced pre-wipe snapshot, so no
objection to allowing it.

**The merge design was dropped.** Drafts tried to carry przedmiar (then stages + progress) across
the swap by matching work items on section + description. The owner cut it: the feature exists to
swap the preset **at the start** of an investment, and loading a preset onto a kosztorys with real
recorded work has no business meaning, so protecting that case is complexity for nothing. Plain
replacement: only the item breakdown goes; VAT and coefficients survive. This removed a whole phase
(a shared work-item identity extraction).

Also rejected:

- **An "effectively empty" gate** (stub rows, no progress, treated as empty). With a reversible wipe,
  telling a stub from a real breakdown buys nothing — one path covers both.
- **An escalated confirmation** — the whole move is reversible.
- `seedInvestmentFromPreset`'s `'not-empty'` guard stays refusing — that is the investment-creation
  path, not this one.

Owner rulings at the review gate (2026-08-12):

- **The global discount is cleared by a reload.** It is not in the snapshot payload, so left alone it
  survived against a zeroed przedmiar and rendered „do zapłaty" (amount due) negative. The dialog
  says so: restoring the pre-reload point does **not** bring the discount back.
- **The restore point is named after the preset** („Przed wczytaniem: «nazwa»"), so repeated swaps
  stay distinguishable. Deliberately uncapped — a manual row surviving the sweep is the feature.
