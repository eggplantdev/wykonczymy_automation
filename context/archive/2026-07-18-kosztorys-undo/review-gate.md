# Review-gate ledger — kosztorys-undo · 2026-07-17

Scope: S-07 in-session undo/redo re-integration. Slice commits `88504da..9312617`
(merged into staging at `5a3d557`). Base `5767b6c`. 10 code files + 3 test files.

## Findings

<!-- ONE checkbox per finding; every source folds here. Most-severe first. -->

### Correctness cluster — undo vs optimistic-autosave / server-write reconciliation (deferred, filed together as EX-526)

- [x] 🟡 WARNING · deferred · filed EX-526 · `code-review` · `use-kosztorys-editor.ts:306,335` · `cancel()` can't stop an already-dispatched forward save (coalesce 700ms > debounce 500ms), so the inverse undo write races the still-in-flight forward write; on a slow network the forward can commit last and silently overwrite the undo — the L295 "can't race" comment doesn't hold for the common case.
      test: TDD · unit — fake timers, forward-save resolves after inverse; assert final persisted value is the inverse.
- [x] 🟡 WARNING · deferred · filed EX-526 · `impl-review` · `use-kosztorys-editor.ts:329,333,353` · Stale grid/reorder command undone _after_ its row was deleted (`handleRemoveItem` doesn't prune/reset the stack) fires writes against the dead id — `setStageProgressAction` is an absolute upsert that can recreate an orphan `stage_progress` for the deleted item; `Promise.all` never checks success.
      test: no automated test · integration — edit/reorder a row, delete it, invoke the captured command's undo; assert no write / no orphan stage_progress.
- [x] 🟡 WARNING · deferred · filed EX-526 · `code-review`+`impl-review` · `use-kosztorys-editor.ts:335` · `runGridReversal` does `await Promise.all(writes)` ignoring `ActionResultT.success` and with no try/catch — a rejected inverse write is an unhandled rejection (via `void undo()` at use-undo-redo.ts:106), a logical failure silently diverges DB from grid; no toast, no revert (forward path has `revertOne`).
      test: TDD · integration — force an inverse-write failure; assert the grid reverts / a toast fires and no unhandled rejection escapes.
- [x] 🔵 OBSERVATION · deferred · filed EX-526 · `code-review` · `use-kosztorys-editor.ts:166` · A failed forward autosave still leaves its coalesced edit as a live undo/redo entry (flush pushes unconditionally, unlinked from save success) → stack depth desyncs from real server state; redo re-issues the failed write.
      test: test-driven-debugging · unit — force a save rejection; assert the failed edit isn't left on the stack.

### UX

- [x] 🟡 WARNING · deferred · filed EX-526 · `code-review`+`impl-review` · `use-kosztorys-editor.ts:955` / `kosztorys-toolbar-actions.tsx:22` · `canUndo`/`canRedo` are stale for ≤700ms after a first-edit keystroke — the burst is buffered (refs, non-reactive) but not pushed, so the toolbar ⟲ button stays greyed while keyboard Cmd+Z (flush-first) already undoes; a stale Redo can stay enabled during the window. (Filed with the cluster; making it reactive needs state not refs — not a trivial fix.)
      test: TDD · unit — fire onChange, assert canUndo before UNDO_COALESCE_MS elapses (pairs with the product decision on whether a pending buffer counts).

### Fix-now (cheap, isolated)

- [x] fixed · `code-review` · `use-debounced-save.ts:26` · The `setTimeout` callback never deletes its own key from the `timers` map after firing, so `cancel()` inspects dead timers and the map grows unbounded across a session — delete the key when the timer fires (identity-guarded).
- [x] fixed · `comment-noise` · `kosztorys-editor-v2.tsx:70` · Trailing "Skips a tick when nothing changed." restates the guard `if (revisionRef.current === lastSnapshotRevision.current) return` — trimmed the tail, kept the fire-and-forget/shell-ownership why.
- [x] fixed · `comment-noise` · `use-kosztorys-editor.ts:892` · Comment restated the two lines under it and duplicated the explanations at the `pendingFields` decl + `flushUndoBuffer` — deleted.
- [x] fixed · `structure-scatter` · `src/__tests__/kosztorys-undo-coalesce.test.ts` · Sat at the flat `__tests__/` root while its subject mirrors to `__tests__/lib/kosztorys/`; the other two slice tests mirror correctly — `git mv`'d to `__tests__/lib/kosztorys/undo-coalesce.test.ts`.

### Dismissed / dropped

- [x] 🔵 OBSERVATION · dismissed · `code-review` · `use-kosztorys-editor.ts:641` · `handleRenameSection` bails on `before === undefined`, narrowing empty-section rename vs the old `?? ''` default — unreachable via current UI (rename cell only exists on an item row). Latent, noted; no live bug.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `kosztorys-toolbar-actions.tsx:1` · Buttons landed in `kosztorys-toolbar-actions.tsx`, not the plan-named `kosztorys-editor-toolbar.tsx` — file-name drift, matches staging's real toolbar composition and the plan's wiring. Benign.
- [x] dropped · `module-cohesion` · `v2-rows.ts:91` · `inverseGlobalCoeffPatch`/`inverseSectionCoeffPatch` could live in their own `inverse-coeff-patch.ts` (they already have a separate test file) — defensible as a "row operations" module; not worth the churn.
- [x] dismissed · `module-cohesion` · `use-undo-redo.ts` · "7 exports / mixes kinds" scanner flag — the 7 are one concept (the undo/redo mechanism); `UndoCommandT`/`UndoRedoApiT` are the API's own contract types. Contract-types false positive.
- [x] dismissed · `feature-first`+`structure-scatter` · `use-undo-redo.ts:34` · Pure `createUndoRedoStack`/`MAX_DEPTH` core sits in a `'use client'` file rather than `lib/kosztorys/` — defensible as one cohesive mechanism (core + its only consumer); not scatter.
- [x] dismissed · `tailwind` · `kosztorys-toolbar-actions.tsx` · Only added class is `size-4` — canonical v4 utility. Clean.
- [x] noted · `module-cohesion` · `use-kosztorys-editor.ts` · +253 into a known 42KB god-module — already tracked as **EX-515** (hook split, deferred). Not a new finding.

### Simplify (folded from `/simplify` — tagged `simplify`)

- [x] fixed · `simplify` · `undo-coalesce.ts:15` · Two near-identical coalesce reducers collapsed into a generic `coalesceBy<T extends {before,after}>(seq, keyOf)`; `coalesceFieldChanges`/`coalesceStageChanges` kept as thin exported wrappers (public API preserved, net-zero drop + copy-before-mutate intact).
- [x] fixed · `simplify` · `use-kosztorys-editor.ts` · The 4 structural push sites deduped behind a `pushReversible(label, apply, before, after)` helper (~15 lines removed).
- [x] dropped · `simplify` · minor local-var inlining / naming nits below the churn threshold — not worth the diff.
- [x] dismissed · `simplify` · proposed extractions that would have split cohesive units (undo core out of `use-undo-redo.ts`) — already dismissed under module-cohesion above; no double-file.

## Simplify pass

Ran `/simplify` — 2 applied (`coalesceBy<T>` generic, `pushReversible` helper), rest dropped/dismissed; each folded into `## Findings` above (tagged `simplify`). Re-verified: `tsc` clean, full kosztorys suite 179 passed.

## Tests & suite

- No new tests owed by the fixes: the 4 fix-now items + the 2 `/simplify` refactors are behavior-preserving (public API + coalesce semantics unchanged); the moved coalesce spec still passes (7 tests, alias import).
- The deferred cluster's regression tests travel with **EX-526** (dispositions recorded on the issue).
- kosztorys unit suite green after every mutation: `tsc` clean, **179 passed** (last run post-`/simplify`).
- Full repo suite (`typecheck && lint && test && test:e2e && build`) — not re-run here; awaiting go.
- Browser E2E for the slice deferred to **EX-525** (`e2e-backlog`) — does not block in-review.
