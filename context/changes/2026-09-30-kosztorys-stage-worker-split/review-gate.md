# Review-gate ledger — kosztorys-stage-worker-split (EX-943) · 2026-09-30

Scope: `staging...HEAD` (local `staging` = `e8026a97`, 125 files), no untracked slice files.
Step 0.5 (browser verification pass) skipped — driving the browser needs an explicit ask; manual
checks stay in `context/foundation/manual-checks.md` § EX-943.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit`,
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review F1 + code-review · `src/lib/kosztorys/subcontractor-due.ts:99`, `src/lib/kosztorys/worker-payout-pairs-fold.ts` · float residue of a full split (Σ shares = pool + 3.6e-12) was credited to `null` — an empty „Nieprzypisane" row in „Podsumowanie podwykonawców" and a phantom unassigned pair — `splitStagePool` now returns `unattributed` (pool only for no split / pool ≤ 0), both folds read it
      test: test-driven debugging · unit — `subcontractor-due-by-plane.test.ts` „credits nobody unassigned on the float residue…", `worker-payout-pairs-fold.test.ts` „leaves no unassigned pair behind…", `stage-split.test.ts` `unattributed` cases
- [x] 🔵 OBSERVATION · fixed · impl-review F2 + code-review · `src/lib/kosztorys/stage-split.ts` `validateStageSplit` · values finer than the stored `numeric(12,2)` passed and drifted by a grosz after reload — refused now
      test: TDD · unit — `stage-split.test.ts` „refuses a value finer than the stored two decimals"
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/kosztorys.ts` `addStageAction` / `updateStageSplitAction` · normalize ran before validate, so a split with no or two rest holders was silently repaired (amount mode moved money) — validate the raw split first
      test: test-driven debugging · integration — `kosztorys-stages.test.ts` „refuses a split nobody takes the rest of, instead of electing one" (5435)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/kosztorys.ts` `updateStageSplitAction` · in-transaction „etap disappeared" refusal had no code, editor stayed on a stale tree — returns `NOT_FOUND`, which reseeds
      test: no automated test · — a race between the gate and the row lock; not reproducible without injecting a concurrent delete
- [x] 🔵 OBSERVATION · dropped · impl-review F3 · `src/lib/actions/kosztorys.ts` `stageSplitSchema` · a deleted member id hits the FK and returns a generic error — nothing is written, the users delete guard makes it rare, same gap as the pre-slice single-worker path
      test: no automated test · — dropped, no behaviour change
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/actions/kosztorys.ts` `stagePatchSchema` · a tab open across the deploy sending `{ workerId }` gets success and writes nothing — deploy-window only, 5 users, reload fixes it
      test: no automated test · — dropped
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/insert-kosztorys-tree.ts` · restore promotes the first surviving member when the rest holder was deleted (amount discarded) — owner decision recorded in `change.md` („Removing the reszta holder…")
      test: no automated test · — intended behaviour
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/grid/stage-header.tsx` · `ReassignWorkerConfirmDialog` removed — planned (owner: „saving asks no extra confirmation", `change.md`)
      test: no automated test · — intended behaviour
- [x] 🔵 OBSERVATION · fixed · impl-review F4 · `change.md` · `copyStageSplit` zeroing amounts, `db/stage-memberships.ts`, import `workerId` undocumented — added under „Implementation notes"
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 · — · `kosztorys_stages.worker_id` drop follow-up — exists as EX-945
- [x] fixed · simplify (reuse/altitude) · `src/lib/kosztorys/stage-split.ts` `splitStagePool` · the „who gets the unshared rest" rule lived twice (editor fold + payouts fold) — one `unattributed` field, both folds call `if (!split || unattributed) credit(null, unattributed)`
- [x] fixed · simplify · `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts:89` · `handleSetStageSplit` re-implemented `patchStageField`'s optimistic/rollback — `patchStageField` takes an optional `write`; kept as a `??` fallback, not a default-param closure, because the default param made React Compiler skip the hook (surfaced as an unused `react-hooks/refs` directive)
- [x] fixed · simplify · `stage-split-dialog.tsx`, `src/lib/kosztorys/worker-view/summary.ts` · rest-holder percent recomputed by hand — `splitStagePool(100, split)` yields the percentages
- [x] fixed · simplify + code-review · `stage-split-dialog.tsx`, `stage-header.tsx` · worker-name fallback duplicated with two different strings („nieznany pracownik" / „nieznana osoba") — `resolveWorkerName`; `STAGE_HEADER_COPY.workerUnknown` deleted
- [x] fixed · code-review · `stage-split-dialog.tsx` · `'Bez przypisania'` / search placeholders duplicated `STAGE_HEADER_COPY`
- [x] fixed · simplify + code-review · `src/lib/actions/kosztorys.ts`, `stage-header-copy.ts` · „etap needs a rozliczenie" said in two strings — `STAGE_SPLIT_NEEDS_PLANE` in `lib/kosztorys/stage-split.ts`
- [x] fixed · simplify · `stage-split-dialog.tsx` · local `activeOrSelected` filter — `isActiveRef`
- [x] fixed · simplify · `stage-split-dialog.tsx` · two copies of the ghost `X` remove button — one local `removeButton`
- [x] fixed · simplify · `src/lib/kosztorys/subcontractor-due.ts` · two consecutive `if (st.split)` merged
- [x] fixed · simplify · `src/lib/kosztorys/stage-split.ts` · `StageSharesT` exported with no importer — unexported
- [x] fixed · simplify · `src/lib/db/stage-split.ts` `insertStageMembers` · the fifth restore INSERT was invisible to the schema-drift guard — `STAGE_MEMBER_INSERT_COLUMNS`, registered in `insert-schema-drift.test.ts`
- [x] fixed · module-cohesion-audit · `src/lib/kosztorys/worker-payout-pairs.ts` · the slice's fold made a grab-bag worse — `foldWorkerPayoutPairs` + `StageDueRowT` + `PaidRowT` → `worker-payout-pairs-fold.ts` (spec split the same way)
- [x] fixed · feature-first-structure · `src/lib/kosztorys/stage-worker-split.ts` · one concept, two names — renamed `stage-split.ts` (+ spec, 31 importers, test-plan row #18)
- [x] fixed · comment-noise-audit · „outgrew the pool" repeated at five sites — kept at the definition; prop-restating comments in `kosztorys-v2-column-opts.ts`, `stage-header.tsx`, `use-kosztorys-stage-ops.ts` deleted; `subcontractor-due.ts` lead-in trimmed
- [x] dismissed · comment-noise-audit · `db/stage-split.ts` JSDocs, `stage-split.ts:62,101`, `stage-conditions.ts:18`, `worker-view/summary.ts`, `delete-blocker.ts:27`, `stage-split-draft.ts:57`, `collections/kosztorys-stages.ts:46`, `insert-kosztorys-tree.ts:36`, dialog `pool` prop · each carries a fact the name doesn't (plane, caller set, cross-file coupling, residual-row rationale)
- [x] dropped · simplify (efficiency ×6) · editor/payouts folds · repeated per-etap scans and map lookups — ≤10 etapy × 5 users, unmeasurable
- [x] dropped · simplify · `STAGE_SPLIT_MODES` const · `satisfies` adds no exhaustiveness over the union
- [x] dropped · simplify · `executedWholeNet` helper · one consumer
- [x] dropped · simplify · `draftFrom` / `draftToSave` inline · named one-liners read better than the inline form
- [x] dropped · simplify · `stageWorkerIds` helper · `null` means different things at each call site
- [x] dropped · simplify · `normalizeStageSplit` via `setRestHolder` · couples the lib rule to a UI draft reducer for two lines
- [x] dropped · simplify · `foldWorkerPayoutPairs` `statuses` map → `investmentStatus` on each row · moves a column into two row types and their SQL for no behaviour change
- [x] dropped · simplify · `insert-kosztorys-tree.ts` double normalize · the first pass is needed for legacy `workerId` snapshots, the second after dropping dead members — merging adds a branch
- [x] dropped · simplify · percent shown with 2 decimals in the dialog, 1 in the worker link · different audiences
- [x] dropped · feature-first-structure · `lib/db/stage-*` vs the `kosztorys-*` prefix · consistent within the slice
- [x] dropped · code-review · stale-tab `workerId` in the import dialog · import builds a one-person split, nothing lost
- [x] skipped · simplify (altitude A4) · normalize at five read points / FK `RESTRICT` instead of `CASCADE` · design + migration change; the migration documents `CASCADE` as intended
- [x] skipped · simplify · `RemoveButton` shared primitive · changes the look (ghostDestructive, icon size) of a dialog layout the owner just approved
- [x] dismissed · module-cohesion-audit · `src/lib/actions/kosztorys.ts` size (+79) · one kind of export; pre-existing sections dominate
- [x] dismissed · feature-first-structure · `db/stage-memberships.ts` beside `db/stage-split.ts` · must stay out of `server-only` for the Payload graph — now in `change.md`
- [x] dismissed · tailwind-v4-audit · `stage-split-dialog.tsx:121-122` `grid-cols-[…]` · grid tracks no scale utility expresses

## Simplify pass

Ran `/simplify` (reuse / simplification / efficiency / altitude) plus the fan-out's fix-now items —
20 applied, 11 dropped, 2 skipped; every finding is a line in ## Findings (tagged `simplify`).

## Tests & suite

- `pnpm typecheck` — clean.
- eslint on the 44 touched files — clean (after the React Compiler fix above); prettier — formatted.
- Touched unit + DOM specs (65 files) — 550 passed, 5 skipped.
- DB specs against 5435 (`kosztorys-stages`, `insert-schema-drift`, `db/worker-payout-pairs`,
  `serialize-restore-roundtrip`, `restore-deleted-worker`) — 28 passed.
- Full suite (`pnpm test`, `test:integration`, `test:parity`, `test:e2e`, `build`) — not run, awaiting the go.
