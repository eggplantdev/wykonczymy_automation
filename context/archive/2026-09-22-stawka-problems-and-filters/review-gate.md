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

_Przycięte przy archiwizacji (2026-09-23): wypadło 25 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 25 fixed, 6 dismissed, 2 dropped, 2 skipped · 0 otwartych._

<!-- [box] [severity, bug-finding checks only] · disposition · source · file:line · what — reason -->

- [x] 🟡 WARNING · dismissed · code-review ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:100-104` · claimed the
      rewritten comment states the opposite of the code, because „the workbench has no plane
      switch". FALSE POSITIVE: the reviewer conflated `KosztorysViewMenu` (netto/brutto axis +
      column reorder, gated at `kosztorys-editor-toolbar.tsx:105`) with the plane switch, which is
      the `ToolbarToggle aria-label="Widok cen"` at `kosztorys-editor-toolbar.tsx:43-49` and is
      rendered UNCONDITIONALLY. Verified twice: that is the only `isWorkshop` gate in the toolbar,
      and the owner's screenshot of `/szablony/7` shows the three-way view toggle on screen.
      test: no automated test — no defect
- [x] dismissed · reuse-scan · `src/components/filters/filter-multi-select.tsx:88` · `BulkSelectRow`
      looked like a reinvention of `ui/checkbox-row.tsx › CheckboxRow` and of
      `ui/dropdown-check-groups.tsx › DropdownCheckGroups`. Neither: both are the wrong substrate —
      `CheckboxRow` is a `<label>` around a Radix Checkbox, `DropdownCheckGroups` emits
      `DropdownMenuCheckboxItem`s, and this row must be a cmdk `CommandItem` so it joins the
      popover's keyboard ring and its search filter. `ColumnToggleMenu`'s `onToggleAll` is a bare
      callback on a dropdown, not a shape to share. Kept as the in-file dedup it already is.
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
