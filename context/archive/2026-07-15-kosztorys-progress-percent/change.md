---
change_id: kosztorys-progress-percent
title: Kosztorys v2 progress percentages with a values/percent display toggle
status: archived
created: 2026-07-15
updated: 2026-07-24
archived_at: 2026-07-24T13:46:37Z
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

kosztorys v2 editor: a progress display toggle (values ↔ percent, never both) for the stage progress columns, optional per-stage % columns, per-row overall done %, and a whole-kosztorys progress counter

**Scope carried in from a sibling slice:** `b77baa1`'s toolbar hunk also ferries `kosztorys-netto-brutto-select`'s `Oba` → `Bez filtra` relabel + legend refactor. That work belonged to `30e1c1f` and was deferred out of it because `kosztorys-editor-toolbar.tsx` was jointly held by a parallel session at the time. The content is correct and was already reviewed under that slice — the commit message just never says so, and a reader of this diff alone sees unexplained scope creep (it cost the review gate 3 verification steps to clear).

**Review gate → EX-489.** The gate (`review-gate.md`) surfaced a pomiar-0 aggregate divergence, and the owner's answer inverted the premise the slice was built on: pomiar ≠ etapy is routine, and work without a pomiar is worth what its stages say. So the counter was reading `150%` on _correct_ data. Fixed inside the gate rather than deferred — a new settlement layer (`rowValueForView` and friends in `v2-rows.ts`, `calc.ts` demoted to pure pricing), a red `% wykonania` cell for rows whose pomiar can't explain the work, and the bridge test that gap had been hiding behind. Rationale: `context/reference/kosztorys-editor-domain-notes.md` → "Pomiar ≠ etapy to stan normalny".

**The 15 `manual-checks.md` boxes must be re-read, not just ticked** — EX-489 changed what several of them should show (the counter's denominator, `Pozostało` on a pomiar-0 row, the new red cell).
