# Review-gate ledger — today's main commits · 2026-10-13

Scope: `f97f695bc..HEAD` (`44301f2a8`) on `main`, 64 files, 12 commits:
`e4287c02f` `165073a6e` `f9944f895` `4b08fc2bc` `77bbf65d2` `4152bbf8f` `defcc1c54` `82e1ac5e9`
`98ee7f439` `ac0ac46b6` `51fc69f72` `44301f2a8`.

Excluded: `worker-draft-merge-receipts` (EX-1048) — its own gate runs in
`wykonczymy-worktrees/worker-draft-merge-receipts`; its research commit `fdfa1b819` goes with it.

Checks: code-review ×2 (kosztorys/style · worker-reports/expenses), tailwind-v4-audit,
feature-first-structure, module-cohesion-audit, structure-scatter-audit, comment-noise-audit.
Dropped: `/10x-impl-review` (no `plan.md` behind these commits). Step 0.5 skipped (Playwright, not asked).

Parallel-tree guard: 5 reviewed files are dirty in the main tree (another session's in-flight work):
`line-draft.ts`, `review-lines-table.tsx`, `worker-report-review.tsx`, `use-kosztorys-editor.ts`,
`work-catalogue.tsx` — `/simplify` must not edit them.

_Trimmed at archive (2026-10-15): 17 of 49 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on. Pre-trim tally: 17 fixed, 7 dismissed, 12 dropped, 3 filed, 10 skipped, 0 open._

## Findings

- [x] 🟡 WARNING · filed EX-1051 · code-review · `review-lines-table.tsx:138` (`RejectCell`) · Odrzuć → „cofnij" on an ALREADY ACCEPTED line restores `{ isRejected: false }` but not `isTicked`, so save sends an undo of the accepted ilość the UI never showed — file is dirty with another session's in-flight work (parallel-tree guard); fix + test disposition recorded in EX-1051 (sub-issue of EX-1049)
      test: test-driven-debugging · unit (`line-draft.test.ts`: buildAccept sends no undo) + dom (`review-lines-table.test.tsx`: Odrzuć→cofnij on accepted row keeps the tick)
- [x] 🔵 OBSERVATION · dismissed · code-review · `accept-worker-report.ts:137` · accept in a stale window silently overrides a rejection saved elsewhere — last write wins; ~5 management accounts, and the line ends visibly accepted, not lost
- [x] 🔵 OBSERVATION · filed EX-1052 · code-review · `accept-worker-report.ts:338` · reject-only save still bumps the investment revision → a colleague's open editor gets a false „changed elsewhere" — file dirty in the parallel tree; folded with simplify efficiency #1
- [x] 🔵 OBSERVATION · dismissed · code-review · `20261013_0_worker_report_line_rejected.ts` · migrate→deploy gap breaks old-code accepts of backfilled lines — additive migration: AGENTS.md order (migrate prod right before push) already covers it; prod migration is the follow-up below
- [x] 🔵 OBSERVATION · dropped · code-review · `20261013_0_worker_report_line_rejected.ts` · backfill has no automated test — one-shot SQL, manual checks #7/#8/#11 cover it
- [x] 🔵 OBSERVATION · dropped · code-review · `kosztorys-view-menu.tsx:106` · „Kolumny" badge counts ticked-off etapy even when every etap column is already gone — cosmetic
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys-view-stages-section.tsx:32` · „Pokaż wszystkie" leaves „Ukryj zakończone" etapy hidden — intended: the filter never writes the ticks (hook header)
- [x] dismissed · feature-first · `rescan-expense-draft.ts` · reads the production Blob store by hard-coded id — read-only, rationale written in the script header
- [x] dismissed · feature-first · `kosztorys-view-stages-section.tsx` · hard-coded Polish beside `t('hideAll')` — the whole view menu is Polish-only („Widok", „Oferta"…); `t` only reuses the shared strings
- [x] skipped · cohesion · `column-selection.ts:127` + `kosztorys-view-menu.tsx:106` · „engaged etap problem suspends etap hides" decided twice — the real dedup is deciding it once in `use-kosztorys-editor.ts`, dirty in the parallel tree; a shared one-liner predicate would just rename `size > 0`
- [x] skipped · cohesion · `use-kosztorys-editor.ts:315` · rename-and-forward plumbing per sub-hook; `isStageHidden` option carries `isStageOff` — file dirty in the parallel tree
- [x] skipped · cohesion · `worker-report-review.tsx:207` · `flagCount` / `isFirstAccept` belong beside `partitionLines` in `line-draft.ts` — both dirty in the parallel tree
- [x] dropped · cohesion · `line-draft.ts` (P1), `review-lines-table.tsx` (P2), `use-kosztorys-editor.ts` (P3), P4–P6 · pre-existing module shape, not worsened materially by this diff
- [x] dropped · scatter · `toolbar/kosztorys-view-menu.tsx` · view-menu cluster sits outside `toolbar/menus/` — pre-existing, low confidence, a pure-move refactor of its own
- [x] dropped · tailwind · `use-wrap-column-widths.ts:13` · JS `12px`/`14px` mirror `text-xs`/`text-sm` — documented beside it; a runtime read is worse
- [x] dropped · tailwind · no Tailwind ESLint plugin — repo-wide tooling, not this diff
- [x] skipped · comment-noise · `review-lines-table.tsx:95,127`, `worker-report-review.tsx:210` · three restating comments — files dirty in the parallel tree
- [x] dismissed · comment-noise · `rescan-expense-draft.ts:7` · „once migration 20261012_1 is applied" goes stale — accurate until prod migrates; prod state not checkable here
- [x] dropped · comment-noise · `expense-drafts.tsx:29` · `canOpenTransfers` now also gates the investment link — the prop's comment names both; a 5-file rename for a naming nit
- [x] dropped · code-review · `db/worker-reports.ts:116` · three count subqueries → one `LATERAL … FILTER` — no gain at this size

- [x] filed EX-1052 · simplify (efficiency) · `accept-worker-report.ts:99` · reject-only save expires 4 collection slugs app-wide (EX-849 pattern) + reads the tree under the lock — narrowing tags is behavior-changing + uncertain; file dirty in the parallel tree
- [x] skipped · simplify (altitude) · `read-only-cell-text.tsx:31`, `cell-select-menu.tsx:41`, `editable-cell-input.tsx:51`, `section-footer-cell.tsx:42,54`, `globals.css:458` · phone 12px cell size stated 6× → one `@utility kosztorys-cell-text` — 4 primitives + tailwind-merge interplay with passed `text-*` classes; needs a browser pass, not a gate edit
- [x] skipped · simplify (altitude) · `column-toggle-menu.tsx:118` · scroll model branches on `footer` → one scroll + sticky search row — sticky inside the Radix menu needs a browser check; the kosztorys menu behaves as its commit intended
- [x] skipped · simplify (altitude) · `kosztorys-v2-columns.tsx:349` · `plannedQty > 0` guard → force `muted` on a null value in `ComputedCell` — one column needs it today; the column guard is node-testable, the cell version needs a dom spec for the same single case
- [x] skipped · simplify (simplification) · `use-hidden-stages.ts:54` · drop `toggleStage` for `setStagesHidden([id], !checked)` — ripples through `use-kosztorys-editor.ts`, dirty in the parallel tree
- [x] skipped · simplify (simplification + altitude) · `column-selection.ts:127` + `kosztorys-view-menu.tsx:106` · engaged-etap rule decided twice — same as the cohesion finding above; same parallel-tree block
- [x] skipped · simplify (simplification + altitude) · `line-draft.ts:20` · `isTicked` + `isRejected` „never both" → one `decision` field — ~25 reads, its own review; recorded in EX-1051 as the root-cause fix
- [x] dropped · simplify (simplification) · `schemas.ts:64` · five `.length` sum → `.some(...)` — cosmetic, file dirty in the parallel tree
- [x] dropped · simplify (altitude) · `review-lines-table.tsx:515` · `wrappedHeader` → `meta.wrapHeader` in `table-header.tsx` — one caller
- [x] dropped · simplify (altitude) · 4 raw `<table>` elements repeat `text-sm max-sm:text-xs` — no `ui/table` primitive; a two-class string
- [x] dismissed · simplify (altitude) · `draft-prefill.ts:47` · `[...mediaIds]` copy placement — only producer, equivalent
- [x] dropped · simplify (efficiency) · efficiency #2–#5 — negligible at this scale

## Simplify pass

Ran /simplify (4 angles) — 5 applied, 0 proposed, 11 skipped/dropped/dismissed, 1 filed (EX-1052); each finding folded into ## Findings (tagged simplify).

## Tests & suite

- `vitest run remaining-overrun-tone.test.ts` — 6/6 green; same spec on HEAD's column code — 1 red (the new guard), so the repro is real
- `pnpm typecheck` — 1 error, not this gate's: `add-items-from-catalogue-dialog.test.tsx:70` misses `onNewItem`, the parallel session's in-flight catalogue/new-item work
- `worker-reports.test.ts` not run — the gate only deleted a comment in it (DB spec, 5435)
- Full suite: not run (user chose touched specs + typecheck)
