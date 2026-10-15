# Review-gate ledger — spike „szukaj w katalogu → albo dodaj nową pracę" · 2026-10-13

Scope: uncommitted on `main`, base `HEAD` (44301f2a8; another session committed on top to 64f8f8ed0
mid-review, none of these files). 21 files (list: spike-files.txt in session scratchpad).
Checks: code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only). No impl-review (no plan.md),
no Step 0.5 browser pass (Playwright only on request).

_Trimmed at archive (2026-10-15): 18 of 36 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on. Pre-trim tally: 18 fixed, 5 dismissed, 10 dropped, 3 skipped, 0 open._

## Findings

- [x] 🟡 WARNING · skipped · code-review · `worker-report-review.tsx` swapInto / onPlaced · the pozycja lands in the rozpiska before „Zapisz zmiany”, the line→pozycja link lives only in the draft; leaving the review (or Odrzuć / Cofnij podmianę) leaves an empty pozycja, and reopening puts the line back in „Spoza rozpiski”, where a second add mints a twin — the immediate save was approved as the spike's design; a server-side pointer (or reopen matching) is a decision for hardening the spike into a change, surfaced to the user
      test: test-driven-debugging · unit — owed together with whichever fix is chosen
- [x] 🟡 WARNING · skipped · code-review · `add-items-from-catalogue-dialog.tsx` canAddNew · empty kosztorys + a typed sekcja name → „Dodaj nową pracę…” refuses with „Wybierz istniejącą sekcję” although none exists — edge of the accepted spike limit (a typed new sekcja can't host the form; `addSectionAction` takes no name); proper fix = a name on `addSectionAction`, for the hardening change
      test: TDD · dom — with that fix
- [x] 🔵 OBSERVATION · dismissed · code-review · `line-draft.ts` lineGroup · an accepted extra line whose pozycja was deleted can't be unticked — Odrzuć undoes it (a rejected accepted line is also undone in `buildAccept`)
- [x] 🔵 OBSERVATION · dropped · code-review · `review-lines-table.tsx` isUnassigned · an extra line pointed at a pozycja deleted mid-review gets the rozpiska wording from the server — needs a delete in another tab during an open review
- [x] 🔵 OBSERVATION · dropped · code-review · `review-lines-table.tsx` SwapNote · after reload a non-katalog pozycja reads „Zgłoszono” not „Z katalogu · zgłoszono” — cosmetic, and correct for a praca not in the katalog
- [x] 🔵 OBSERVATION · dropped · code-review · `worker-report-review.tsx` defaultSectionOf · two sekcje of one name preselect the first — only a default, the select is right there
- [x] 🔵 OBSERVATION · dismissed · code-review · extra-group column persistence · the hints column keeps its HEAD id `catalogue`, nothing new to persist
- [x] dropped · code-review · `worker-report-review.tsx` / `new-item-host.tsx` · j.m. list and sekcja-name lookup written twice — one-liners, a helper's params would equal the code
- [x] dismissed · module-cohesion-audit · `review-lines-table.tsx` · 559 LOC, 15 cells — one table's columns, cohesive; shrank in this spike
- [x] dropped · structure · `catalogue-swap-dialog.tsx` name · „swap” no longer matches „Dodaj pracę do rozpiski” — the line's words are still swapped for a praca (`catalogueSwap`, `SwapNote`); renaming is churn
- [x] dismissed · tailwind-v4-audit · no findings
- [x] skipped · simplify · `add-line-to-rozpiska.tsx` / `new-item-host.tsx` · a second NewItemDialog host repeating the editor host's wiring (+ `canKeepOpen`) — merging means opening the editor's host over the zgłoszenia window and reshaping its request API; a refactor for the hardening change
- [x] dropped · simplify · `catalogue-swap-dialog.tsx` vs `add-items-from-catalogue-dialog.tsx` · two katalog windows (single / multi pick) — table and filters already shared; the rest differs for real, a mode flag would add branches
- [x] dropped · simplify · `line-draft.ts` / `review-lines-table.tsx` · `isTicked: false` set in two patches (undo, Przenieś) — two explicit patches, both pinned by specs; a normalizer adds indirection for two lines
- [x] dropped · simplify · `catalogue-candidate-row.tsx` showFigures · a flag on the shared row — one boolean; a second hand-built link would duplicate the row's glyph and layout
- [x] dropped · simplify · `form-creatable-combobox.tsx` · Input-like class string repeated — matches FormCombobox's own; a token for two call sites is churn
- [x] dropped · simplify · `line-draft.ts` isLineReady · `lineGroup` check redundant with `itemId !== undefined` in practice — keeps the rule readable as the user said it
- [x] dismissed · simplify · efficiency · no findings

## Simplify pass

Ran /simplify — 8 applied, 3 skipped (hardening refactors), 4 dropped, efficiency clean; each folded into ## Findings (tagged simplify).

## Tests & suite
