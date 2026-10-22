# Review-gate ledger — kosztorys-view-freeze-while-editing · 2026-10-22

Scope: `69db87d29..HEAD` (3dfe5e15b, 46b270be4, 8791ac927). Step 0.5 skipped — browser pass not
requested this turn, Playwright MCP unreachable. Tailwind audit dropped — no `className` in the diff.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/components/kosztorys/editor/hooks/use-view-latch.ts:36` · the latch key held only the latching condition ids, so on the worker report under a search phrase, switching „Wszystkie prace" back off left the empty pozycje on screen — the key now reads the whole engaged set, `enabled` still the latching ids only
      test: test-driven-debugging · integration — `use-kosztorys-editor-view-freeze.test.tsx` „the worker report under a search phrase" was red ([1, 2]) and is now green
- [x] 🟡 WARNING · fixed · impl-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:569` · nothing guarded the rank recording, so deleting it would bring back the sort jump with every spec green — moved to `latchViewRows` in `row-view.ts` (this also fixes module-cohesion's "latch bookkeeping in the composition entry")
      test: TDD · unit — `row-view.test.ts` „replays the order it recorded…"; mutation check: with the `rank.set` line removed the spec goes red
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:385` · `shownStagesOf` runs twice per `buildV2Grid` — about 10 etapy, and returning it from `assembleV2Columns` would change its signature and its two consumers
- [x] dropped · code-review · `src/lib/kosztorys/row-view.ts:137` · under section scope the latch groups and sorts twice — about 1 ms on 1000 rows
- [x] dismissed · code-review · `use-view-latch.ts:43` · setState during render under the React Compiler — compiled; no loop, `viewRows` guarded on the latch's identity
- [x] dismissed · code-review · sort identity / stage latch / ranks / undo / `refreshView` before the renumber — all checked, no defect
- [x] fixed · module-cohesion-audit · `use-kosztorys-editor.ts:569` · row rank recording in the composition entry — via `latchViewRows` (above)
- [x] fixed · comment-noise-audit · `row-view.ts:7` · the `ViewLatchT` comment repeated the hook's JSDoc and its list of actions was incomplete — deleted
- [x] fixed · comment-noise-audit · `row-view.ts:69` · the `inFrozenOrder` comment narrated the code, and its "an undo" was wrong — deleted
- [x] fixed · comment-noise-audit · `row-view.test.ts:29` · the `latchOf` comment explained the fixture — deleted
- [x] fixed · comment-noise-audit · `use-view-latch.ts:21` · the JSDoc listed the key fields `sameKey` already compares — trimmed to the first sentence
- [x] fixed · comment-noise-audit · `problem-conditions.ts:49` · a pointer at `useViewLatch` — removed
- [x] fixed · comment-noise-audit · `use-kosztorys-editor.ts:272` · the `holdNewRow` reason was too narrow now that a search also latches — cut to „a new praca never would under the usual filters"
- [x] fixed · comment-noise-audit · `kosztorys-v2-columns.tsx:135` · the resolver comment sat above `scaledDownStageIds` after the narrowing moved — now sits above `shownStagesOf`
- [x] skipped · simplify (altitude) · `src/lib/kosztorys/row-conditions/queries.ts:38`, `stage-conditions.ts:55`, `row-view.ts:19` · the latched-id bypass is threaded into three filter primitives; one `keepLatched` step in `buildViewRows` would cover them all — refactors the `applyRowConditions(…, latchedRowIds)` pattern, which predates this slice and which the slice followed. That is a review-worthy refactor, not a cleanup
- [x] skipped · simplify (altitude) · `kosztorys-v2-columns.tsx:385` / `use-kosztorys-editor.ts:521` · stage-id round trip (opts in → `shownStageIds` out → recorded in render) — moving the stage narrowing into the editor changes `buildV2Grid`'s contract, which ~10 grid specs pin
- [x] skipped · simplify (altitude) · `use-item-ops.ts:84`, `use-section-crud.ts:147` · `holdNewRow` is opt-in for each creation path (`handleAppendedSections` leaves it out) — the derived "unknown id = held" rule changes behaviour; under a search, appended sections that don't match were hidden before this slice as well
- [x] fixed · simplify (reuse + altitude) · `row-view.ts:76` · `inFrozenOrder` re-implemented `sortRows` — now a second stable pass of the same scope sorter on rank (`?? null`), so the hand-written branch per scope is gone
- [x] fixed · simplify · `row-view.ts:7` / `use-view-latch.ts:8` · one latch shape written three ways — one mutable `ViewLatchT`, `EditorViewLatchT = ViewLatchT & { stageIds }`
- [x] fixed · simplify · `use-view-latch.ts:31` · the hook returned `null`, forcing `latch ?? undefined` at the call site — it returns `undefined` now
- [x] fixed · simplify · `problem-conditions.ts:58` · `engagedLatchingIds` built a Set only for `.size > 0` — now `hasLatchingCondition(): boolean`; spec updated
- [x] dropped · simplify · `use-view-latch.ts:13` · string key + separate sort identity in place of `KeyT`/`sameKey` — marginal gain
- [x] dropped · simplify (efficiency) · `row-view.ts:132` · under a latch the value sort only places unranked rows; slotting by rank saves 0.2–2 ms per keystroke on 1000 rows
- [x] dismissed · feature-first-structure · no placement findings
- [x] dismissed · structure-scatter-audit · the slice adds no scatter, no new home and no junk drawer

## Simplify pass

Ran /simplify (4 angles: reuse, simplification, efficiency, altitude): 4 applied, 3 skipped, 2 dropped. Each finding is folded into ## Findings, tagged simplify. primitive-reuse-scan was covered by the reuse angle; the diff has no markup or `className`, so the clone detector had nothing to scan.

## Tests & suite

- Touched specs (11 files, 113 tests): row-view, problem-conditions, stage-conditions, row-view-sort-scope, row-view-sort-within-sections, kosztorys-v2-rows, view-freeze, use-view-latch, reported-only, editor memoization, toolbar — green
- `pnpm typecheck` — clean; eslint on the touched files — clean
- Full suite (`pnpm test`, e2e, build) — not run; waiting for the user's go
