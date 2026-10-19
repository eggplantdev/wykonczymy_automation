# Review-gate ledger — app-audit-refactor-wt · 2026-10-19

**Scope:** `staging (4c456b4e1)..app-audit-refactor-wt (c2d4d5ee9)` — everything the branch adds on top of
local staging after merging it: plan phases 3–8, the kosztorys perf fixes (hand memos + compiled-output
specs), the staging merge resolution, and `debf6ca3c` (leads dialog). 40 commits, 435 files.
Phases 1–2 were gated on staging in `review-gate.md`.

**Step 0.5 (browser verification):** skipped — not requested.

## Findings

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit` (flag-only),
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit` (diff-scoped).
`code-review` found no correctness defect and no semantic merge conflict; `tailwind-v4-audit` found nothing.

- [x] 🟡 WARNING · filed · impl-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:507` · `columns` is
      rebuilt every render, so the body and row-sizing memos keyed on it recompute anyway, and their compiled-output specs
      can't see it — staging does the same; memoizing it means pinning ~45 inputs (handlers, `widths` mid-resize) — EX-1116
      test: TDD · integration (dom) — EX-1116's per-keystroke work-budget spec
- [x] fixed · suite · `e2e/worker-page-gates.spec.ts:58` · still expected the 404 for an EMPLOYEE on his own `/kasa/{id}`;
      plan phase 2 (5f57e7a43) made it redirect to his `/pracownicy/{id}` — spec now asserts the redirect
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` Desired End State / Progress 8.2, `ledger.md` · still claimed the memos
      were stripped — ledger „Perf fix” entry added, end state reworded, 8.2 closed as superseded
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` Progress 3.4 · open while `print-window.ts:28` keeps `document.write`
      as a ledgered skip — closed with that reason
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/helpers/react-compiler-cache.ts` · no known-positive: a helper
      that reported everything cached would pass every memoization spec — fixture where a scope spans a hook call
      test: TDD · unit — `helpers/react-compiler-cache.test.ts` asserts fresh / derived-fresh / cached / unknown
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/editor/hooks/use-editor-rows.ts:15` ·
      `useRef(new Map(rows.map(…)))` rebuilt a ~1000-entry Map every render on the keystroke path — lazy `useState` init
- [x] 🔵 OBSERVATION · dismissed · impl-review · `use-editor-rows.ts` / `use-section-crud.ts` · ref sync moved into
      `useLayoutEffect` — same commit-time write, refs read only in handlers; ledgered
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys-editor-body.tsx` memos keyed on `columns` · same as the
      `columns` finding above (EX-1116)
- [x] dismissed · main-thread · `react-compiler-cache.ts` `isHookCall` · in a file the compiler bails on, a hand
      `useMemo` keyed on a fresh value still reads as cached — same class as the `columns` gap; EX-1116 measures the outcome
- [x] fixed · comment-noise · `src/lib/actions/kosztorys-settings.ts:12` · stale „above 0,65” — the ceiling is per plane
      (`MAX_CLIENT_SHARE`)
- [x] fixed · comment-noise · `use-investor-actions.ts:43`, `material-sync-preview.ts:41`, `kosztorys-items.ts:41` ·
      fragmented / wordy comments joined and trimmed
- [x] dismissed · comment-noise · „Hand-memoized:” clauses in `use-row-sizing.ts:46`, `kosztorys-editor-body.tsx:228`,
      `use-kosztorys-editor.ts:329`, `work-catalogue-data-table.tsx:71` · each names what breaks without the memo — the
      memos were stripped once already for lack of exactly this
- [x] dismissed · comment-noise · `use-grid-change-pipeline.ts:79`, `use-client-pagination.ts:14`, `use-item-ops.ts:65`
      and `:93`, `use-row-sizing.ts:48`, `kosztorys-items.ts:52` and `:77`, `kosztorys-settings.ts:30`,
      `db/snapshots.ts:204`, `db/worker-expense-drafts.ts:696` · each states a reason the code can't (hidden rows, no grid
      re-render, stale rows, Warsaw day boundary, the percent rabat's home) — not restatement
- [x] fixed · feature-first-structure · `src/lib/worker-expenses/paragon-refusal.ts:1` · imported its type up from
      `lib/actions/expense-draft-flows` — `ParagonRefusalT` now lives beside `paragonRefusalFailure`; `expense-draft-flows`
      stays in `lib/actions` (multi-step mutations live there per `AGENTS.md`)
- [x] fixed · feature-first-structure · `editor/grid-empty-overlay.tsx` → `editor/grid/grid-empty-overlay.tsx`
- [x] dismissed · feature-first-structure · `src/lib/trash/unique-holder.ts` · a one-file domain home for the
      trashed-aware uniqueness check is the right home, not a scatter
- [x] dismissed · feature-first-structure · `collections/fields/trashed-at.ts`, `use-status-investment-filters.tsx` ·
      the audit itself rated them acceptable
- [x] dropped · feature-first-structure · `contract-dialog.tsx` → `dialogs/` · pre-existing placement, not this diff
- [x] fixed · module-cohesion-audit · `src/components/forms/expense-form/row-select.tsx` · config type + builders split to
      `row-select-config.ts`
- [x] dismissed · module-cohesion-audit · `src/lib/kosztorys/sheet-import/read-import-plan.ts` · 72 lines, one concern:
      read a plan from the sheet plus its failure fallbacks; moving the messages into `classify-sheet-failure.ts` would
      pull server-only deps into a pure classifier
- [x] dismissed · module-cohesion-audit · `src/lib/cash-registers/register-types.ts` · every map is keyed on the register
      type, border colours included
- [x] dismissed · module-cohesion-audit · `use-kosztorys-editor.ts` (761 lines) · the composition entry by design
      (`components/kosztorys/AGENTS.md`); its clusters already live in `editor/hooks/`
- [x] dismissed · structure-scatter-audit · `editor/actions/use-*-action(s).ts` (9 hooks) · each serves the one action
      component beside it — a one-consumer hook stays with its consumer (`AGENTS.md` hook-home rule)
- [x] dismissed · structure-scatter-audit · `use-kosztorys-editor.ts` / `use-kosztorys-editor-context.tsx` at the editor
      root · documented composition entry
- [x] skipped · structure-scatter-audit · subdividing `lib/kosztorys/` (121 files), `editor/hooks/` (40),
      `forms/expense-form/` (24) · no defect, only size; re-pathing hundreds of imports under parallel agents is its own
      review-worthy refactor

## Simplify pass

Ran `/simplify` over the fix-pass diff (14 files) — 1 applied (two `paragon-refusal` imports in
`lib/actions/transfers.ts` merged), 0 proposed. No second report; the fan-out's fix-now items are in `## Findings`.

## Tests & suite

- typecheck — passed (the first run failed only on a stale `.next-e2e` validator for the deleted `/wyplaty`; clean after
  the e2e build rebuilt it)
- lint — passed
- test — passed (596 files, 5938 tests)
- test:integration — passed (160 files, 885 tests)
- test:e2e — 77 passed, 1 failed (`worker-page-gates.spec.ts:58`, stale spec above); the spec re-run 4/4 green
- build — passed
