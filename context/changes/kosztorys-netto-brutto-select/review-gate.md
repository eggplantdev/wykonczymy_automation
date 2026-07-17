# Review-gate ledger — kosztorys-netto-brutto-select · 2026-07-15

Scope: `c385ad1^..HEAD` (this slice's three commits), 8 source files. NOT `main..HEAD` — the branch
carries 60 commits, including the parent slice `kosztorys-stage-values`.

Fan-out: 10x-impl-review, code-review, tailwind-v4-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit, comment-noise-audit. Step 0.5 (verification pass)
skipped — no `verify-manual-checks` skill installed; the manual checks in
`context/foundation/manual-checks.md` remain the human gate.

Mid-gate owner change: the third option's label went `Oba` → **`Bez filtra`** (the `'both'` value is
unchanged). Toolbar, legend, and the manual checks were updated to match.

## Findings

- [x] 🟡 WARNING · deferred · `code-review` · `use-kosztorys-editor.ts:105` · a sort survives its
      column leaving the grid: the header that clears it disappears, `sort` stays non-null, and
      `RowActionsCell` then greys out insert/reorder on every row with no visible cause — filed
      **EX-486**
      test: test-driven-debugging · unit — deferred with the fix into EX-486
- [x] 🟡 WARNING · skipped · `code-review` · `constants.ts:108` · on the default picker, `Brutto`
      leaves **no** per-stage value column at all (`stageValueGross` is in `DEFAULT_HIDDEN_COLUMNS`,
      `stageValueNet` is dropped by the axis) while the picker still reads "Etapy — kwota netto ✓".
      Each half is correct; the composition is an owner judgement, not a defect — routed to
      dogfooding as a manual check, and pinned by a spec so nobody "fixes" it by accident
      test: unit — the current composition is now asserted in `kosztorys-money-axis.test.ts`
- [x] ⚠️ WARNING · skipped · `impl-review` · `use-money-axis.ts:47` · the plan promised "no
      post-hydration flash"; `readAxis` is `getSnapshot`, so a stored `net` paints the wide grid for
      one frame before narrowing. Not drift — it is `usePriceView`'s shape verbatim, the precedent
      the plan told it to borrow; the plan over-claimed. A real fix spans all three sibling hooks.
      Added a manual check instead; dogfooding decides
      test: no automated test — a one-frame paint is not unit-observable; browser-level or nothing
- [x] 🔵 OBSERVATION · fixed · `code-review` · `kosztorys-money-axis.test.ts:26` · the `both` spec
      compared two `buildV2Columns` calls, so it asserted "the default is `both`", not "`both` is a
      no-op" — it would pass if `axisAllows` returned `false` for everything. Added a spec asserting
      every net + gross id is actually present
- [x] 🔵 OBSERVATION · fixed · `code-review` · `kosztorys-money-axis.test.ts:15` · every spec ran
      with the picker fully open — a state no real user is in. Added a spec driving the real
      `DEFAULT_HIDDEN_COLUMNS`; it is what pins the finding above
- [x] 🔵 OBSERVATION · deferred · `code-review` · `use-kosztorys-editor.ts:86` · pre-existing, and
      adjacent: `sortValue` falls through to `row[field]` for seven **computed** columns that are not
      row fields, so sorting by any of them is a silent no-op behind a working-looking arrow — filed
      **EX-487**
      test: test-driven-debugging · unit — deferred with the fix into EX-487
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `constants.ts:81` · `discountValue` is untagged
      but carries a netto basis when `discountType='amount'`. Fail-open behaving as designed; the
      column is genuinely neutral for `%`. Tagging it would hide a discount the owner is reading
- [x] fixed · `comment-noise` · `kosztorys-editor-toolbar.tsx:41` · the `MONEY_AXES` comment restated
      the domain why already written at its canonical home, `money-axis.ts:3`, one import line above
- [x] fixed · `comment-noise` · `use-money-axis.ts:9` · dropped "Same useSyncExternalStore shape as
      its siblings" — restates the import. The three clauses after it are load-bearing; kept
- [x] dismissed · `comment-noise` · `constants.ts:98` · the `NON_HIDEABLE_COLUMNS` analogy tail is
      mildly decorative but points at a real sibling pattern. Not worth the churn
- [x] fixed · `simplify` · `kosztorys-editor-toolbar.tsx:41` · `AXIS_LEGEND` hard-copied `MONEY_AXES`'
      labels — the `Oba` → `Bez filtra` rename this very turn needed two edits in lockstep, with no
      type or test to catch a miss. The legend now derives from a per-option `hint`
- [x] fixed · `simplify` · `kosztorys-money-axis.test.ts:44` · hoisted `ids(axis)` out of the inner
      loop, matching the file's own idiom
- [x] proposed → deferred · `simplify` · `use-money-axis.ts` · the four localStorage hooks are ~90%
      identical; a `createPersistedEnumStore` factory would touch three siblings outside this diff —
      filed **EX-488**
- [x] dismissed · `simplify` · `kosztorys-v2-columns.tsx:711` · "the picker is axis-blind, so it
      renders dead controls" — this is a **settled owner decision** (`change.md`: an axis-hidden
      column still reads as checked), and the comment at `kosztorys-v2-columns.tsx:92` already says
      "axis-blind by design". The audit misread documented intent as an oversight
- [x] skipped · `simplify` · `kosztorys-money-axis.test.ts:64` · a guard asserting every
      `/netto|brutto/i` label is tagged would catch a new column shipped untagged. A label-regex
      heuristic is a design choice, not a mechanical fix — and fail-open means the cost is a shown
      column, never a hidden one
- [x] dismissed · `tailwind-v4-audit` · — · zero findings in scope. The new ToggleGroup is a
      structural mirror of the price-view one; the repo's arbitrary-value residue all predates this diff
- [x] dismissed · `feature-first-structure` / `module-cohesion-audit` / `structure-scatter-audit` · — ·
      zero findings across all three. `money-axis.ts` mirrors `calc.ts`, `use-money-axis.ts` mirrors
      the four-hook convention, the spec matches the flat `kosztorys-*.test.ts` home (nested is for
      real-DB specs, 4/4 vs 2/2, no counterexample). The axis tag living in `constants.ts` is
      load-bearing: moving it to `money-axis.ts` would close an import cycle

## Simplify pass

Ran `/simplify` — 2 applied, 3 proposed, 4 dismissed; every finding folded into `## Findings` above
(tagged `simplify`). One correction applied by hand afterward: the pass reported its `AXIS_LEGEND`
refactor as byte-identical output, which it was not — two legend lines were absent. Those turned out
to be the **owner's** own deliberate cut, not the agent's, so the restore was reverted. The lesson
stands for the ledger: "byte-identical" from a mutating agent is a claim to verify, not accept.

## Tests & suite

- `pnpm exec vitest run src/__tests__/kosztorys-money-axis.test.ts` → **10/10 green** (8 original + 2
  added this gate).
- `pnpm exec eslint` on the slice's five source files → **clean, exit 0**.
- `pnpm typecheck` → **one error, not this slice's**: `src/lib/kosztorys/progress-display.ts:1` wants
  `COLUMN_PROGRESS_DISPLAY` from `constants.ts`. That file is untracked and belongs to a **parallel
  session** working `kosztorys-progress-percent`.
- `pnpm exec vitest run src/__tests__` → **1 failure, not this slice's**:
  `kosztorys-calc.test.ts > stageDoneFraction / rowDoneFraction` returns `NaN` against the same
  parallel session's dirty `calc.ts`.

**The suite gate could not be run cleanly, and that is not a finding against this slice.** A parallel
agent holds `calc.ts`, `format.ts`, `v2-rows.ts`, `constants.ts`, and `.gitignore` dirty mid-edit.
Nothing was staged, and none of their files were touched. **Re-run `pnpm typecheck && pnpm test` once
that tree settles, before this slice merges** — that is the one automated box this gate leaves open
for a human.
