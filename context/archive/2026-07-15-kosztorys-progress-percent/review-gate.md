# Review-gate ledger — kosztorys-progress-percent · 2026-07-15

Scope: commits `63c8a32` (p1), `7ee38ee` (p2), `b77baa1` (p3), `24ebf54` (epilogue).
Step 0.5 (browser verification pass) skipped by user — the 15 `manual-checks.md` boxes stay the human gate.

Fan-out: `/10x-impl-review`, `/code-review` (high), `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all 7 applied, all read-only.

Two independent bug-finders (impl-review F1, code-review #2) converged on the same pomiar-0 aggregate
divergence. **The owner then inverted the assumption underneath it** (see EX-489 below), which turned
the gate's largest finding from a documentation question into an urgent fix landed inside this gate.
Two other reviewer findings were **false positives caught only by cross-checking** the prior slice's
ledger — recorded below rather than acted on.

## The owner's call that reframed the review (2026-07-15)

The reviewers found the pomiar-0 divergence but described it as an edge case, and `calc.ts` documented
`>100%` as meaning "the measurement or the entry is wrong". The owner's answer: **pomiar ≠ etapy is
routine, not an error**, and **work without a pomiar HAS value — the value the stages state.**

That inverts the premise: the counter was reading `150%` on _correct_ data, not on a mistake. So the
finding was not deferrable — it was fixed in this gate, test-first, with the red highlight the owner
asked for. Full rationale now lives in `context/reference/kosztorys-editor-domain-notes.md`
("Pomiar ≠ etapy to stan normalny").

## Findings

- [x] 🟡 WARNING · fixed · `impl-review`+`code-review` · `src/lib/kosztorys/v2-rows.ts:335,344` · A `Pomiar = 0` row fed the aggregates' NUMERATOR but not their DENOMINATOR — counter read `Wykonano: 150,0%` while every row honestly rendered `—`; `Pozostało` read `−500` on a row with nothing left to do; an all-pomiar-0 section hid real done value behind `—`. Root cause was altitude: `calc.ts` gave two different answers to the identical `measuredQty === 0` condition four lines apart. **Fixed under EX-489, not deferred** — the owner's rule (work without a pomiar is worth what its stages say) made the aggregates' silence the bug. New `rowValueForView` in `v2-rows.ts` is now the single settlement-value primitive; `rowRemainingForView` + `sectionSubtotalsForView` moved there with it (both now need stages); `calc.ts` is documented as the stage-blind pricing layer and `rowNetForView` is explicitly no longer "the row's value".
      test: test-driven-debugging · unit — proven red first (14 failures) on `rowValueForView` / `rowRemainingForView` / the bridge over a mixed dataset, then green. The old fixtures all used `measuredQty: 10`, which is exactly why the suite could not see it.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/calc.ts:120,126` · `measuredQty === 0` is strict-equality, but the Pomiar cell is `Column<number|null>` and writes `null` on clear — the guard fell through and divided anyway. **Verified by execution:** rendered literal `NaN%` (qtyDone 0) or `∞%` (qtyDone 3) in the always-visible `% wykonania` column, contradicting the docstring four lines above it. Fixed via a shared `doneFraction` helper guarding `!(row.measuredQty > 0)`; `stageValueForView` now guards the same way, so the whole file answers `measuredQty` consistently.
      test: test-driven-debugging · unit — red first (`AssertionError: expected Infinity to be null`), then green.
- [x] 🟡 WARNING · fixed · `impl-review` F2 · `src/__tests__/kosztorys-v2-rows.test.ts` · No executable guard on the invariant the UI claims: the slice publishes one progress story through TWO algorithms — the row cell is a QUANTITY fraction, the section % and counter are VALUE ratios. Each was pinned in isolation; nothing asserted they reconcile once summed. `lessons.md` names this twice ("an invariant enforced in two planes needs a test on the BRIDGE"). The only thing on the bridge was a human checkbox — and the 150% bug is precisely what that gap hid.
      test: TDD · unit — the bridge spec IS the deliverable ("most: licznik „Wykonano" a wiersze siatki"). Proven red before the fix, so it is not tautological.
- [x] 🔵 OBSERVATION · fixed · `verify`/owner · `src/lib/tables/kosztorys-v2-columns.tsx:678,697` · `% wykonania` and `Netto` rendered in full-strength foreground despite being read-only, unlike every other computed column. `computedColumn`'s `className` param REPLACES the default `'text-muted-foreground'` rather than appending, so passing `'font-medium'` silently dropped the read-only signal. Both now pass `'text-muted-foreground font-medium'`.
      test: no automated test · — pure colour token on a read-only cell; asserting a className would pin the implementation, not the behaviour. Covered by manual check 4.x.
- [x] 🔵 OBSERVATION · fixed · owner request · `kosztorys-v2-columns.tsx:678` · Red highlight when the pomiar cannot explain the recorded work (`hasMeasurementMismatch`): stages overshooting the pomiar, or work billed against no pomiar. Deliberately NOT "pomiar ≠ Σ etapów" — a half-done row is normal WIP and would paint the whole grid red. `computedColumn` now takes `className` as `string | (row) => string`.
      test: TDD · unit — `hasMeasurementMismatch` pinned on all four states (WIP / exact / overshoot / no-pomiar) + the cleared-cell null case.
- [x] 🔵 OBSERVATION · deferred · `impl-review` F4 · `plan.md:245-247` · The browser-level E2E this slice owes (toggle → column set changes → counter visible) is neither authored nor filed. **Filed EX-490** (label `e2e-backlog`, project Wykonczymy) with the four scenarios + the note that EX-489 changes the counter's denominator, so its assertions must follow the new model.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/kosztorys/kosztorys-section-summary.tsx:148` · Two decimal separators on one line: `(s.share * 100).toFixed(1)` emitted a dot while `formatPercentPrecise` beside it emits a pl-PL comma → rendered `5 poz. · 33.3% · wyk. 74,6%`. Replaced with `formatPercentPrecise(s.share)` (already imported on that line). Verified as the only `.toFixed(1)` percent left in the feature.
- [x] fixed · `impl-review` F5 + `code-review` · `use-kosztorys-editor.ts:183-186` · `doneNet` and `sectionDoneNet` each walked `O(rows × stages)` independently with identical deps, where the former is exactly `Σ` of the latter's values. `doneNet` now derives from `sectionDoneNet` — the idiom the file already uses one line up (`totalNet` from `subtotals`). Documented 1000+ row scale. As the sequencing note predicted, the pomiar-0 rule landing in `sectionDoneNetForView` is inherited by the derived total for free.
- [x] fixed · `code-review` · `src/lib/kosztorys/calc.ts:119-128` · `stageDoneFraction`/`rowDoneFraction` had byte-identical bodies (the docstring conceded it). Deduped into `doneFraction` — which halved the places the null-guard fix had to land, exactly as the finding predicted.
- [x] fixed · `code-review` · `src/components/kosztorys/use-progress-display.ts:40` · `for (const l of listeners) l()` → `for (const listener of listeners) listener()`. Inherited verbatim from `use-money-axis.ts:43`; that copy stays for EX-488 to unify.
- [x] fixed · `comment-noise` · `v2-rows.ts:328,343` (deleted) + `format.ts:6-7`, `calc.ts:116-117` (trimmed) · 2 deleted, 2 trimmed; 8 kept as load-bearing. The slice is why-dense, not noise-dense. `calc.ts:116-117`'s trim was not cosmetic — it asserted "a >100% reading means the measurement or the entry is wrong", the exact claim the owner inverted.
- [x] fixed · `comment-noise` · `format.ts:6-7` / `calc.ts:109-110` · Rationale DUPLICATION, not narration: the dash-vs-0% why was stated 3× across files. `format.ts` now points at `stageDoneFraction` instead of restating it. The percent-survives-VAT why (`constants.ts:105`, `columns.tsx:661`) is left as-is: both copies sit in tooltips a user reads in isolation.
- [x] deferred · `impl-review` F3 · `change.md` · Traceability only: `b77baa1`'s toolbar hunk also ferries `kosztorys-netto-brutto-select`'s `Oba` → `Bez filtra` relabel + legend refactor (deferred out of `30e1c1f` because the file was jointly held by a parallel session). Content correct and already reviewed; the commit message never says it. Recorded in `change.md` Notes.
- [x] deferred · `feature-first-structure` · `src/lib/tables/kosztorys-v2-columns.tsx:1` · Wrong tier: `src/lib/tables/` is a ONE-file directory holding a 776-line `'use client'` component that imports `@/components/*` six times — the heaviest `lib/ → components/` violation in the repo. Belongs at `src/components/kosztorys/v2-columns.tsx` (NOT `lib/kosztorys/`, which holds a component-free invariant). Pre-existing (`4483258`); this slice deepened it. **Filed EX-491.**
- [x] deferred · `feature-first-structure` · `src/types/kosztorys.ts:1` · Single-feature type file in the cross-feature tier (AGENTS.md: `src/types` is "cross-feature only"); all 16 importers are kosztorys. Pre-existing, untouched by this slice. Wide (16 importers + a managed `constants.ts` ↔ `types.ts` cycle); payoff is consistency alone. **Filed EX-492** (Low).
- [x] deferred · `tailwind-v4-audit` · `package.json` · No Tailwind-aware ESLint plugin: `h-[calc(100dvh-7rem)]` sits at `kosztorys-editor-body.tsx:70` while `eslint` exits clean — this class of issue is invisible to CI. Skill recommends `eslint-plugin-better-tailwindcss`. **Filed EX-493.**
- [x] skipped → **superseded** · `module-cohesion` · `v2-rows.ts:317-355` · "Move the 3 money aggregations to `calc.ts` beside `sectionSubtotalsForView`." Skipped at triage: it argued against `plan.md:21`/`:87`, which placed them in `v2-rows.ts` precisely to avoid a `calc → v2-rows` cycle. **EX-489 then settled it in the opposite direction** — `sectionSubtotalsForView` moved OUT of `calc.ts` INTO `v2-rows.ts`, because a row's value now depends on its stages. The reviewer read the tension correctly and guessed the wrong direction; the layer split (calc = pricing, v2-rows = settlement) is now explicit in both files' headers.
- [x] dismissed · `code-review` · `kosztorys-editor-toolbar.tsx:49-52` · "The `AXIS_LEGEND` refactor silently dropped two lines documenting live invariants." **False positive — caught only by cross-checking the prior ledger** (`kosztorys-netto-brutto-select/review-gate.md:81-84`): those two lines were the **owner's own deliberate cut**, not an agent's loss. A restore was already attempted there and reverted.
- [x] dismissed · `code-review` · `use-progress-display.ts:1-47` · "~45 of 47 lines clone `use-money-axis.ts`; extract a factory." Real, but **already filed as EX-488** by the previous slice's gate (which found the same duplication across all four localStorage hooks). Not re-filed.
- [x] dismissed · `module-cohesion` · `constants.ts:107` · `COLUMN_PROGRESS_DISPLAY` re-spells the `'values' | 'percent'` union inline instead of reusing `ProgressDisplayT`. It CANNOT import it (`progress-display.ts:1` imports from `constants.ts` — reverse edge cycles), and `COLUMN_MONEY_AXIS:88` has the identical shape. The slice was right to match the neighbour; the prior ledger settled this exact question.
- [x] dismissed · `module-cohesion` / `feature-first` / `structure-scatter` · `progress-display.ts`, `use-progress-display.ts`, `kosztorys-progress-counter.tsx` · Scanner flags on the 3 new files are false positives. Each is a line-for-line structural mirror of its `money-axis` sibling. Zero scattered kinds, zero stray files, zero catch-alls. `use-progress-display.ts:6-9` names its precedent in a comment — which is WHY the convention held under extension.
- [x] dismissed · `tailwind-v4-audit` · — · Zero in-scope findings; every class the slice added is a plain registered utility. Its 2 hits (`kosztorys-editor-body.tsx:70`, `:146`) both predate the slice; `:146` is a legitimate exception (runtime drag position no utility can express).
- [x] dismissed · `structure-scatter` / `feature-first` · `src/lib/kosztorys/format.ts` · My dispatch brief wrongly listed this as slice-CREATED. Two agents independently corrected it and I verified (`git cat-file -e 63c8a32^:...` → exists). The slice only appended 2 formatters to a file born at `6bd7c74`. Worth recording: **the bad brief pointed TOWARD a plausible-sounding finding** ("slice created a competing formatter home vs `lib/utils/format-currency.ts`") that is simply false — a reviewer fed a wrong premise will find evidence for it.
- [x] dismissed · `impl-review` · — · Plan adherence exact across all 3 phases: no MISSING, no DRIFT, every "What We're NOT Doing" boundary honored, no remount `key` (EX-422 lesson respected). Automated criteria re-run by the reviewer, not trusted from the boxes.

## Simplify pass

Ran `/simplify` — its findings are folded into `## Findings` above (tagged `code-review`/`comment-noise`,
which is where the fan-out surfaced them first). Net: 6 applied (dedup `doneFraction`, derive `doneNet`
from `sectionDoneNet`, `formatPercentPrecise` drop-in, `listener` rename, 2 comment deletions + 2 trims),
0 proposed, 0 held back. No separate report file — this ledger is the single source of truth.

The layer move (`rowRemainingForView` + `sectionSubtotalsForView` → `v2-rows.ts`) also retired two
`as unknown as ViewPricingT` casts at the grid's value columns and collapsed a 9-line nested
`toGross(rowRemainingForView(...))` call into one line.

## Tests & suite

- `pnpm exec vitest run` (kosztorys specs) — **red first**: 14 failures across `rowValueForView`,
  `rowRemainingForView`, `sectionSubtotalsForView`, `hasMeasurementMismatch`, the bridge. Then green.
- `pnpm test` — **917 passed / 31 skipped** (was 905/31 at fan-out; +12 net after the EX-489 specs
  and the move of `rowRemainingForView`/`sectionSubtotalsForView` coverage out of `kosztorys-calc.test.ts`).
- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec eslint src` — 0 errors (87 pre-existing warnings, none in touched files).
- `pnpm test:e2e` — not run; the slice's E2E is filed as EX-490, and no browser spec touches this feature.

## Archive status — BLOCKED, slice is "in review"

Every finding box is checked; **no open `[ ]` remains**. The archive stays blocked on the other,
independent gate: the **15 unticked boxes in `context/foundation/manual-checks.md`**. Step 0.5 was
skipped by the user, so a human still owes the browser pass — and EX-489 changed what several of
those checks should now show (the counter's denominator, `Pozostało` on a pomiar-0 row, the red cell),
so they must be re-read against the new model, not just ticked.
