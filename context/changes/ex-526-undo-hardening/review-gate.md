# Review-gate ledger — EX-526 undo hardening · 2026-07-18

Scope: reconcile undo commands with the optimistic-autosave lifecycle + server-write success.
Files: `save-lanes.ts` (+test), `use-debounced-save.ts`, `use-undo-redo.ts` (+test), `use-kosztorys-editor.ts`.
Fan-out: `/code-review` + `comment-noise-audit` + file-organization audits (module-cohesion, feature-first, structure-scatter). Dropped: `/10x-impl-review` (no plan.md), `tailwind-v4-audit` (no styling touched).
Step 0.5 browser verify: not driven yet (timing races — in-flight save vs inverse write). Manual checks are **registered + owed**, not skipped: `manual-checks.md` → S-07 → "Faza 4: hardening cyklu autosave↔undo (EX-526)" (4.a–4.d), the Done blocker. Automated E2E for the two DB-integration scenarios owed by S-07, filed as EX-525.

Out of scope (separate uncommitted concern, left untouched): `fold-text.ts` (+test), `command.tsx` — diacritic search extraction, not EX-526.

## Findings

<!-- Implementation itself addresses the 5 ticket findings; review fan-out surfaced 6 more. Most-severe first. -->

### Ticket findings (EX-526 #1–#5) — implemented

- [x] 🟡 fixed · impl · `save-lanes.ts`, `use-debounced-save.ts`, `use-kosztorys-editor.ts:runGridReversal` · #1 inverse write races in-flight forward save → per-key serialized write lane; inverse `runNow` chains behind any in-flight forward.
      test: TDD · unit — `save-lanes.test.ts` "serializes same-key writes: inverse runs after in-flight forward".
- [x] 🟡 fixed · impl · `use-undo-redo.ts:pruneByIds`, `use-kosztorys-editor.ts:handleRemoveItem/handleRemoveSection` · #2 stale command after row delete → orphan writes → `touchedIds` on commands + `pruneByIds` drops them on delete.
      test: TDD · unit — `use-undo-redo.test.ts` pruneByIds block (4 cases). Integration (no orphan `stage_progress` in DB) deferred → EX-525.
- [x] 🟡 fixed · impl · `save-lanes.ts:enqueue`, `use-debounced-save.ts:dispatch` · #3 `runGridReversal` ignored `success`/no try-catch → lane checks `!success` + catches rejections, routes to toast; end-of-fn `router.refresh()` resyncs. No unhandled rejection escapes.
      test: TDD · unit — `save-lanes.test.ts` logical-failure + thrown-action cases. Integration (forced inverse failure → grid reverts) deferred → EX-525.
- [x] 🔵 fixed · impl · `use-kosztorys-editor.ts:onChange` (dropPendingField/Stage) · #4 failed forward save left a coalesced edit on the stack → drop the reverted change from the still-buffering burst; post-flush failures resync via the lane. **Partial** — see F-A.
      test: no automated test — hook has no test harness (EX-515 deferral); mechanism is the pure buffer-filter, covered by review. Residual is cosmetic (F-A).
- [x] 🟡 fixed · impl · `use-kosztorys-editor.ts` (hasPendingBurst) · #5 canUndo/canRedo stale during ≤700ms window → reactive `hasPendingBurst`; `canUndo = canUndo || pending`, `canRedo = canRedo && !pending`. Product call: a buffering burst counts as undoable.
      test: no automated test — hook has no harness; drain-edge guarded by clearBurstIfEmpty (F-B).

### Review fan-out findings

- [x] 🟡 fixed · code-review · `use-kosztorys-editor.ts` (clearBurstIfEmpty) · F-B `hasPendingBurst` stuck true after an error-revert empties the buffer → canUndo false-positive → `clearBurstIfEmpty()` cancels the flush + clears the flag when the buffer drains.
      test: no automated test — hook has no harness; logic is a straight emptiness check.
- [x] 🟡 skipped · code-review · `use-kosztorys-editor.ts:onChange` · F-A #4 buffer-drop only covers the <~200ms fast-fail window (debounce 500ms < coalesce 700ms); a slow failure lands after flush, leaving a stale command. Residual is cosmetic now that failures toast + `router.refresh` resync (redo re-fails with a toast, undo is a no-op). Full fix = link push to per-key save-settle (async flush redesign) — not worth it for throwaway data; recorded, not filed.
- [x] 🔵 dismissed · code-review · `use-undo-redo.ts:pruneByIds` · F-C prune is all-or-nothing per command: deleting one row of a co-edited burst discards the surviving rows' undo history. Safe + documented in-code; replaying a dead-id write is strictly worse. Accepted.
- [x] fixed · code-review · `runGridReversal` · F-E redundant N× `router.refresh` via per-write onWriteError → removed onWriteError; the unconditional end-of-fn refresh already covers failures.
- [x] fixed · code-review · `save-lanes.ts` · F-F `isBusy`/`SaveLanesT` unused in prod (test-only) → removed; rewrote the one structural test to assert lane independence via ordering.
- [x] 🔵 dropped · code-review · `use-kosztorys-editor.ts` · F-D canRedo greyed for a net-zero burst window (button briefly disabled though redo stays valid). Cosmetic ≤700ms edge; not worth the branching to special-case net-zero.
- [x] fixed · comment-noise · `use-debounced-save.ts:17`, `save-lanes.ts:14,37` · trimmed framework-narration comments (ref-stability restatement, `isBusy` aspirational rationale — moot after removal, `tails` type restatement).
- [x] fixed · simplify · `use-kosztorys-editor.ts` · two near-identical error-revert callbacks → `dropPendingField`/`dropPendingStage` helpers co-located with clearBurstIfEmpty.
- [x] dismissed · simplify/structure · `save-lanes.ts` · reuse + file-org audits clean: no existing serial-queue/mutex helper to reuse; `src/lib/kosztorys/` is the correct pure-logic home; `hasPendingBurst` is a necessary reactive mirror, not derivable.

## Simplify pass

Ran /simplify (4 agents: reuse / simplification / altitude / efficiency-folded). 1 applied (callback dedup), 0 proposed, rest confirmed clean. Each finding folded into ## Findings (tagged simplify/code-review/comment-noise). No separate report file — findings are above.

## Tests & suite

- typecheck (`tsc --noEmit`): green
- lint (eslint, changed files): green
- unit (`vitest` kosztorys suites + save-lanes + use-undo-redo): 188 passed / 11 pre-existing skips
- full suite (test:e2e / build): pending user decision
- Integration tests owed (F2 no-orphan, F3 forced-failure revert): deferred to EX-525 (S-07 E2E backlog), dispositions recorded above.
