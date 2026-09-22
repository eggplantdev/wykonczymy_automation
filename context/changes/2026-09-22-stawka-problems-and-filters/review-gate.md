# Review-gate ledger — 2026-09-22-stawka-problems-and-filters (EX-820) · 2026-09-22

Unit of work: the uncommitted diff on `staging` — 22 modified files + 2 untracked
(`context/changes/2026-09-22-stawka-problems-and-filters/`,
`src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.test.tsx`).

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill installed, and driving the
browser unprompted is ruled out. The slice's manual checks are registered in
`context/foundation/manual-checks.md` for the human pass.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applicable,
all seven ran read-only. `tailwind-v4-audit` returned 0 findings (instrument validated against a
known positive one directory over).

## Findings

<!-- [box] [severity, bug-finding checks only] · disposition · source · file:line · what — reason -->

- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/subcontractor-price-guard.ts:60` ·
      `isCoeffFlagged` missed a NEGATIVE mnożnik — the one coefficient value that still flooded
      „Problemy" row by row. `investmentCoeffsSchema` is a plain `z.coerce.number()`
      (`src/lib/actions/kosztorys.ts:76`), so `-0.1` is reachable; the field then rendered in the
      normal tone, `coeffWarning` returned `null`, and every „auto" pozycja matched
      `negative-rate-*`. Widened to `coeff > MAX_CLIENT_SHARE || coeff <= 0`, and `coeffWarning`
      gained a third sentence naming the refusal the crew hits per pozycja.
      test: test-driven-debugging · unit — `subcontractor-price-guard.test.ts` „ujemny mnożnik
      ostrzega trzecim zdaniem" (red first, now green)
- [x] 🟡 WARNING · fixed · code-review · `src/components/filters/filter-multi-select.tsx:271-282` ·
      the bulk row's `forceMount` did not survive the scenario its own comment described: cmdk
      skips registration for a force-mounted Item, so it never joins `state.filtered.groups`, and
      the enclosing `CommandGroup` — NOT force-mounted — hides on a search phrase matching no
      toggle, taking the bulk row with it. Removed the prop and its false comment rather than
      repairing a guarantee nobody buys: `kosztorys-filters-menu.tsx` passes no `searchable` (only
      `kosztorys-sections-menu.tsx:72` does), so the prop is inert today and would not have worked
      for the searchable caller it promised.
      test: no automated test — the claim was deleted, not the behaviour; no consumer combines
      `searchable` with `togglesBulk`, so there is nothing to pin
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/empty-grid-copy.ts:27-40` ·
      `emptyGridCopy` enumerated EVERY engaged hider. „Odznacz wszystkie" makes 12 hiders reachable
      in one gesture, so the sentence became a ~380-character run-on. Capped at three named hiders;
      above it the copy counts instead of listing, through the new
      `activeFilterHidesPhrase` (`counted-nouns.ts`) so 2–4 take the paucal.
      test: TDD · unit — `empty-grid-copy.test.ts` counts instead of enumerating above the cap
- [x] 🟡 WARNING · fixed · code-review + impl-review ·
      `src/lib/kosztorys/subcontractor-price-edit.ts:42-51` · `modeChange`'s docstring claimed the
      „kwota stała" seeding is verdict-neutral. The mode gate falsifies it: an „auto" row at 90% is
      silent, and flipping the source seeds the same number as an override, which is immediately
      red. Rewritten to say the switch is a change of source that can deliver a verdict without
      moving a liczba.
      test: no automated test — prose only, the behaviour is intended
- [x] 🟡 WARNING · fixed · code-review ·
      `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:94-97` · adjacent
      rationale the diff falsified („the guard's STANDING verdict, in every mode … a raised global
      coefficient"). Rewritten: the cell carries the standing verdict on a kwota stała only, and
      says why „auto" is judged once in the mnożnik's own field instead of once per pozycja.
      test: no automated test — prose only
- [x] 🟡 WARNING · dismissed · code-review ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:100-104` · claimed the
      rewritten comment states the opposite of the code, because „the workbench has no plane
      switch". FALSE POSITIVE: the reviewer conflated `KosztorysViewMenu` (netto/brutto axis +
      column reorder, gated at `kosztorys-editor-toolbar.tsx:105`) with the plane switch, which is
      the `ToolbarToggle aria-label="Widok cen"` at `kosztorys-editor-toolbar.tsx:43-49` and is
      rendered UNCONDITIONALLY. Verified twice: that is the only `isWorkshop` gate in the toolbar,
      and the owner's screenshot of `/szablony/7` shows the three-way view toggle on screen.
      test: no automated test — no defect
- [x] fixed · structure-scatter · `src/lib/kosztorys/row-conditions/registry.ts:25,395,405` ·
      **this slice created a second home for the subcontractor-price verdict.** The ceiling
      predicate (`isFixedRateOverCeiling`) and the negative-rate predicate were written once in
      the guard and once in the registry; `calc.ts` returns the override verbatim, so the guard's
      ceiling branch reduces exactly to the registry's copy, and the negative pair was literal.
      Both predicates now live in the guard (`isFixedRateOverCeiling`,
      `isSubcontractorPriceNegative`) and the registry imports them; the registry's local copies
      and the comment claiming a single home it did not have are gone.
- [x] fixed · structure-scatter · `src/components/filters/filter-multi-select.tsx:202-207,275-283` ·
      the bulk `CommandItem` was written twice verbatim — same icon, same
      `bulkLabels?.deselect ?? 'Odznacz wszystkie'` fallback pair. Collapsed into one local
      `BulkSelectRow`, used by both call sites.
- [x] 🔵 OBSERVATION · fixed · code-review ·
      `src/components/filters/filter-multi-select.tsx:274-282` · the new bulk `CommandItem` carried
      no `value`, so cmdk derived `data-value` from its text — identical to the `actionRows` bulk
      row. `BulkSelectRow` now takes an explicit `id` (`bulk-options` / `bulk-toggles`) and passes
      the visible text as `keywords`, so search still matches while the two values stay distinct.
      test: no automated test — unreachable today (no caller passes both `options` and
      `togglesBulk`); fixed as a correctness guard at the moment the shared row was extracted
- [x] 🔵 OBSERVATION · fixed · code-review ·
      `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts:74` · `setMany(ids, engaged)`
      shadowed the hook-scope `const engaged` (the persisted map) ten lines up, and — unlike
      `clear()` — always built a fresh object, so a no-op call serialised localStorage and
      re-rendered the editor. Parameter renamed to `engage`; the updater now returns `prev`
      unchanged when nothing moved.
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/constants.ts:33-38` ·
      `FLAGGED_TONE`'s rationale outlived both halves of its claim. Rewritten to name the three
      surfaces it actually tones and the two shapes it now covers (a breach of the sufit, and a
      mnożnik of zero or below), keeping the „why not a second colour" reason.
- [x] 🔵 OBSERVATION · fixed · code-review ·
      `src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts:63-65` · the
      third assertion pinned `PROBLEM_CONDITIONS.label`, already pinned by
      `problems-menu-model.test.ts:34-37`. Assertion and its now-unused import removed.
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` Progress 4.1 · the ticked box claimed
      „zbiorcze odznaczenie **gasi siatkę** i zapala licznik"; the spec mocks the editor context
      wholesale, so nothing renders a grid. Reworded to claim only the counter, with the grid half
      marked as the manual check it is.
- [x] fixed · feature-first · `src/components/filters/filter-multi-select.tsx:61` +
      `use-kosztorys-filter-menu.ts:10` · the `togglesBulk` contract
      (`{ allActive, onToggleAll }`) was spelled out in both files. Exported as
      `FilterTogglesBulkT` from the component that owns the prop; the producer now imports it.
- [x] fixed · module-cohesion · `src/lib/kosztorys/row-conditions/registry.ts:486` ·
      `clientConditionIds()` was the one _query_ in a data file. Moved to the sibling
      `row-conditions/queries.ts` with its two frozen sets; its spec block travelled from
      `registry.test.ts` to `queries.test.ts` so the mirror still holds.
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts:165` ·
      vanished-state narration restating the test's own name — deleted with the block that moved.
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts:99` ·
      „Zero used to be caught only by … has just taken away" — vanished-state, rewritten to name
      the rule that holds today.
- [x] fixed · comment-noise ·
      `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.test.tsx:40,68` ·
      two comments restating the code they sit on — both deleted.
- [x] fixed · comment-noise · `src/lib/kosztorys/row-conditions/registry.ts:377` · vanished-state
      half trimmed; the sentence naming the consequence kept.
- [x] fixed · comment-noise ·
      `src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts:73` · „the fix
      above" was diff-relative — rewritten to the reason the second test exists.
- [x] fixed · impl-review + code-review + comment-noise · `registry.ts:325` ·
      `workshop-columns.test.ts:76` · `kosztorys-editor-domain-notes.md:446` · in-place comment
      edits grew far past `printWidth: 100` (prettier reflows neither comments nor markdown prose).
      All three rewrapped; the tree re-measured in CHARACTERS, not bytes — Polish diacritics and
      „" inflate a byte count by ~5 per line, which is what hid them.
- [x] fixed · reuse-scan · `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts:66` · the diff
      rewrote this line and left the plane list as an inline `(['w_tools', 'own_tools'] as const)` —
      the only inline copy left in non-test source, against nine sites reading `TOOL_PLANES`
      (`constants.ts:11`). Routed onto the constant.
- [x] fixed · suite · `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts:4` · the gate's own
      module-cohesion fix left `applyRowConditions` imported but unused once the `clientConditionIds`
      block moved out — lint went 85 → 86 warnings. Import dropped; spec re-run green (34).
- [x] dismissed · reuse-scan · `src/components/filters/filter-multi-select.tsx:88` · `BulkSelectRow`
      looked like a reinvention of `ui/checkbox-row.tsx › CheckboxRow` and of
      `ui/dropdown-check-groups.tsx › DropdownCheckGroups`. Neither: both are the wrong substrate —
      `CheckboxRow` is a `<label>` around a Radix Checkbox, `DropdownCheckGroups` emits
      `DropdownMenuCheckboxItem`s, and this row must be a cmdk `CommandItem` so it joins the
      popover's keyboard ring and its search filter. `ColumnToggleMenu`'s `onToggleAll` is a bare
      callback on a dropdown, not a shape to share. Kept as the in-file dedup it already is.
- [x] fixed · simplify · `src/lib/kosztorys/empty-grid-copy.ts:38-49` · the cap added a second
      `return` carrying the same `title: 'Wszystkie pozycje schowane'` — the exact drift the
      function's own docstring says it exists to prevent. Description pushed into a local
      `hidersDescription`; the branch returns the title once.
- [x] fixed · simplify · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:9-10` ·
      two separate `import` statements from `row-conditions/queries` after `clientConditionIds`
      moved there. Merged.
- [x] fixed · simplify · `src/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu.ts:36` ·
      `allActive` and `onToggleAll` both invert (`!engaged.has`, `!next`) with nothing saying why —
      a row is ticked when its condition is NOT engaged. One clause added; the inversion itself is
      the contract, not a wart to unwind.
- [x] dropped · simplify · `src/lib/kosztorys/row-conditions/registry.ts:194-235` · the four new
      `fixed-rate-*-ceiling-*` entries are a per-plane × polarity cross product that a
      `TOOL_PLANES.flatMap` factory would halve. Not done: every one of the ~30 entries in this
      table is written out literally (including the two `no-*-price` and two `negative-rate-*`
      pairs), and a table that is half declarative and half generated is harder to read than one
      that repeats itself. The module-cohesion audit cleared the file as exactly that — one
      declarative table.
- [x] dropped · simplify · `use-kosztorys-filter-menu.ts:37` + `kosztorys-filters-menu.tsx:18` ·
      the `!engagedConditionIds.has(id)` inversion is written in both the hook and the component.
      A shared predicate would be a one-line function whose parameters restate its body — no win.
- [x] dismissed · comment-noise · `src/components/kosztorys/editor/toolbar/active-filters-model.ts:74` ·
      flagged as the third copy of one rationale. Kept: this is the only site where a reader would
      actively type `label` and silently lose the „w widoku …" tail — the narrow trap the audit's
      own rule exempts. The auditor's own lean was also "keep".
- [x] dismissed · module-cohesion · `src/lib/kosztorys/subcontractor-price-guard.ts` · proposed
      splitting `isCoeffFlagged` / `coeffWarning` into a `coeff-guard.ts`. Declined: both halves are
      one business family („what the company won't pay a crew"), the file is 109 LOC, and the split
      would put `MAX_CLIENT_SHARE` across a module boundary at the same moment the scatter finding
      is moving MORE of the verdict in. The auditor flagged it borderline and asked for a decision;
      this is the decision.
- [x] skipped · module-cohesion · `src/components/filters/filter-multi-select.tsx:78` ·
      `FILTER_NONE` is the URL-param encoding sentinel living in a popover component, co-owned
      across a layer boundary by `use-client-multi-filter.ts`. Real and pre-existing — this slice
      added one prop and never touched it. A 3-site move is a filters-tier cleanup with its own
      blast radius, not EX-820's.
- [x] skipped · structure-scatter · `src/lib/kosztorys/` · ~90 flat files beside three
      subdirectories, with condition modules straddling the line (`row-conditions/` vs flat
      `problem-conditions.ts` / `problem-groups.ts` / `stage-conditions.ts`) — you could not predict
      a new condition module's home. Pre-existing; the slice edited both sides and created neither.
- [x] dismissed · impl-review · `src/components/filters/filter-multi-select.tsx:275` · „`forceMount`
      is inert for its only consumer, keep it". Superseded: code-review showed the prop does not
      work even when a `searchable` caller arrives, so it is being fixed rather than kept as-is.
- [x] dismissed · module-cohesion · `src/lib/kosztorys/row-conditions/registry.ts` (488 LOC) and
      `src/components/kosztorys/editor/use-kosztorys-editor.ts` (1333 LOC) · size-heuristic hits,
      both explicitly cleared by the auditor: the registry is one declarative table with private
      helpers only its entries call, and the editor hook is the documented EX-521 composition entry
      that this slice grew by 2 pass-through lines.

## Simplify pass

Ran the mutating pass (`/simplify` + `primitive-reuse-scan`) serially after the read-only fan-out —
5 applied, 2 dropped, 1 dismissed, 0 proposed; every one folded into `## Findings` above (tagged
`simplify` / `reuse-scan`). No separate report: this ledger is the one record.

`primitive-reuse-scan` homes came from the repo's own `.reuse-scan.json`
(`src/components/ui`, `src/hooks`, `src/lib/**`, `src/types`), widened for this diff with
`src/components/filters/` and `src/components/kosztorys/editor/hooks/`. Catalogue built by one
read-only subagent, signatures only (~560 symbols). The diff's six new symbols were matched
against it: `TOOL_PLANES` was the one real reinvention (fixed above), `BulkSelectRow` a verified
non-match (dismissed above), and the other four already sit beside the primitive they belong with —
`activeFilterHidesPhrase` next to `itemVanishesPhrase` in `counted-nouns.ts` and routed through
`pluralize`, `isFixedRateOverCeiling` / `isSubcontractorPriceNegative` next to `isOverCeiling` in
the guard, and `FilterTogglesBulkT` exported from the component that owns the prop.

## Tests & suite

- **E2E disposition: dropped, not filed.** The slice is browser-level but nothing in it crosses
  client → server action → DB → revalidation: „Odznacz wszystkie" writes one localStorage map
  through `useEngagedConditions`, and the filters/problems split is pure view state. Per AGENTS.md
  that routes to the DOM layer, which is where it landed
  (`kosztorys-filters-menu.test.tsx`, 4 specs). The two halves a jsdom spec genuinely cannot see —
  the grid going empty and the red mnożnik field — are the EX-820 block in
  `context/foundation/manual-checks.md` (8 boxes, for the human pass).
- Targeted re-runs after the gate's fixes, all green: `subcontractor-price-guard` (19),
  `active-filters-model` (15), `kosztorys-filters-menu` (4), `empty-grid-copy` (6),
  `row-conditions/queries` (36).
- **Whole-tree gate re-run after every fix in this ledger (2026-09-22, exit 0):** `pnpm typecheck`
  clean · `pnpm lint` 0 errors / 86 warnings · `pnpm test` **3908 passed / 335 skipped** (336 files,
  73 skipped) in 82s · `pnpm build` compiled in 83s. The `/10x-implement` gate earlier the same day
  read 3906 passed — the +2 are this slice's two new specs. The 86th warning was the gate's own
  doing and is fixed above, so lint is back at the pre-existing 85.
- `pnpm test:e2e` deliberately NOT run — no browser-crossing risk in this slice (see the E2E
  disposition above) and the suite costs ~1h.

## Archive gate

**Not archivable — the slice stays `in review`.** Every `## Findings` box is `[x]`, so the gate's own
blocker is clear, but `context/foundation/manual-checks.md` carries **8 unticked EX-820 boxes** and
manual checks passing is a hard blocker for `Done`. Linear EX-820 is already In Progress with the
`in review` tag (the team has no In Review state), so no tracker move is owed.

The slice is committed on `staging` (this ledger travels in that commit) and not pushed — a human
pushes to remotes.
