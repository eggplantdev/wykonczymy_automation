---
change_id: pomiar-bez-etapu
title: „Pomiar z natury" vs the stage sum — a standing view and an in-app manual fix
status: archived
created: 2026-08-13
updated: 2026-08-14
archived_at: 2026-08-14T16:05:00Z
branch: pomiar-bez-etapu
worktree: ../wykonczymy-worktrees/pomiar-bez-etapu
---

## Notes

> The slug `pomiar-bez-etapu` comes from the first, **rejected** idea (a synthetic bucket stage for
> the difference). It stays as the folder id — nothing in this change creates such a stage.

The sheet import loses work the owner ticked in „Pomiar z natury" but never broke down into stages.
In the app's model pomiar IS the stage sum (EX-494/EX-489), so that work has nowhere to land.

Evidence gathered 2026-08-13 (formulas read via `scripts/inspect-sheet.mjs`):

| Sheet                                    | Pomiar as formula `=SUM(D:M)` | Pomiar > Σstages      | Pomiar < Σstages    |
| ---------------------------------------- | ----------------------------- | --------------------- | ------------------- |
| canonical (16 July, blank offer)         | 435 / 435                     | 0                     | 0                   |
| „wypełniony kosztorys do testów"         | 0 / 253                       | 27 items (+18 782 zł) | 3 items (−4 279 zł) |
| investment 31 (11 listopada Gabinety)    | 0 / 245                       | 32 items (+41 377 zł) | 0                   |

> **Superseded (2026-08-20):** the survey measured only one formula shape, which is why it came out
> binary; see domain notes § „Zawężone 2026-08-20" and `context/reference/kosztorys-sheet/formula-anomalies.md`.

Investment 31 shows it most cleanly: the sheet footer carries TWO amounts — „wartość netto"
508 196 zł (Σ `Pomiar × Cena j.m.`) and „R netto - suma prac wykonannych" 466 819 zł (`SUM(U:AD)`,
the stage values). The app computed 466 819 zł, equal to the second to the złoty. The 41 377 zł gap
sits in 32 items; in 30 of them the stages are empty and Pomiar is typed in (fitting taps, basins,
traps, WCs, radiators, doors, sockets, lamps). In Podłogi it is one item: „Posadzki z mikrocementu" —
Pomiar 95, stages 25 + 30 = 55, i.e. 38 000 zł vs 22 000 zł; the sheet's own balance column shows
16 000 zł there.

### Agreed shape (owner decisions, 2026-08-13)

- **A read-only reference number per item.** The import stores the hand-typed Pomiar. It feeds no
  labor, margin or crew settlement — its only job is comparison. The model is unchanged: the stage sum
  stays the only truth about work done. The "two truths" objection (EX-494) doesn't apply: the stored
  number computes nothing, so it doesn't compete for that role.
- **Discrepancy computed live**, not stored — the list shrinks as the owner enters stage quantities
  ("this list should be dynamic so it doesn't shout about a discrepancy that's gone").
- **A standing view, not import-time only** — "we'll fix it in the app", not wait for the sheet.
- **A "discrepant only" row filter** in the grid, to fix in place.
- Owner-only — never in the client view.

> **Superseded (2026-08-13/14, 2026-08-18):** the per-row „Etapy są prawdą" action was removed (no
> per-row escape hatch), the tooltip with both numbers was dropped, and the difference is now the
> column „Rozjazd między arkuszem Google a apką", shown only with the „z pomiarem do rozpisania na
> etapy" filter. Re-import no longer restores references; „Porównaj z arkuszem" refreshes and clears
> them. Current truth: domain notes § „Rozjazd nie ma wyjścia awaryjnego" and following.

### Rejected

- **A synthetic „Pomiar bez etapu" stage** for the difference — reasons in domain notes (EX-686).
- Restoring „Pomiar z natury" as a **computing** field — brings back the two-truths problem the model
  cut on purpose.
- Gluing the difference onto the last non-empty stage — silent, wrong attribution (a crew settled for
  work it didn't do).
- Blocking the import until the sheet is fixed — in practice blocks everything.
