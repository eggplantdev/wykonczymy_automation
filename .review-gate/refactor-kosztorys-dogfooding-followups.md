# Review-gate ledger — refactor/kosztorys-dogfooding-followups (PR #25) · 2026-07-17

Base: origin/staging...HEAD · 63 files · EX-512→EX-517 refactors + EX-477/508/509 fixes
Checks run: code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit, comment-noise-audit
(/10x-impl-review dropped — no single plan.md unifies the branch)

Disposition policy this gate: **fix-first, no new Linear issues** (owner directive) — every real
finding is fixed in code or dropped-if-cosmetic. Nothing deferred to the backlog.

## Findings

### Correctness (code-review)

- [x] 🟡 WARNING · fixed · code-review · `use-kosztorys-editor.ts` handleVatChange · VAT save-failure was SILENT with 0 rows — toast + rollback both gated behind `prevVatRate !== undefined`. Fix: early-return on success; toast now fires unconditionally on failure, rollback stays guarded (a no-op when there were no rows). Restores the EX-509 "three surfaces never disagree" invariant on the EX-508 empty-seed path.
      test: no automated test — the hook has no component/integration harness (EX-515 hook extraction deferred); path manually verified. The rollback primitive it calls (`applyRestoreItem`/`patchRows`) is unit-covered.
- [x] 🔵 OBSERVATION · fixed · code-review · `lib/utils/parse-decimal-input.ts` · accepted Infinity/-Infinity/1e999 as `{kind:'value'}`. Fix: `!Number.isFinite(value)` → `{kind:'invalid'}` in the now-centralized primitive.
      test: TDD · unit — added `parse-decimal-input.test.ts` (4 tests incl. 'Infinity'/'-Infinity'/'1e999' → invalid).
- [x] 🔵 OBSERVATION · fixed · code-review · `use-kosztorys-editor.ts` handleRemoveItem + `row-ops.ts` · delete-failure revert spliced at a pre-await absolute index; a concurrent optimistic op during the await misplaced the reinserted row. Fix: capture `afterId` (neighbor id) at removal, resolve against the CURRENT array via new `applyRestoreItem(rows, row, afterId)`. Upgraded from deferred → fixed under the fix-first directive.
      test: test-driven-debugging · unit — 4 tests in `kosztorys-v2-rows.test.ts` (reinsert after neighbor; front when afterId null; correct despite concurrent edit; append when anchor gone).
- [x] 🔵 OBSERVATION · skipped(cosmetic) · code-review · `kosztorys-row-actions-menu.tsx` · confirm copy "Usunąć pozycję?" doesn't disclose the last-item→section cascade. Copy-only, no data-loss discrepancy — dropped as cosmetic per owner directive.
- [x] 🔵 OBSERVATION · dismissed · code-review · `use-persisted-enum.ts` · shared module-level listener Set — benign (useSyncExternalStore bails on unchanged snapshot; one extra getItem per unrelated write). Documented in the header comment.

### Structure / cohesion

- [x] fixed · feature-first · `parse-decimal-input.ts` · generic decimal parser moved feature-tier → `src/lib/utils/`; 3 kosztorys call sites repointed.
- [x] fixed · module-cohesion · `kosztorys-v2-columns.tsx` · finished the `cells/` extraction — `cells/discount-columns.tsx` (discountValue/discountType), `cells/unit-column.tsx`, `cells/section-name-cell.tsx`. Main file keeps only the assembly/selection pipeline; dead imports removed.
- [x] fixed · module-cohesion · `constants.ts` · extracted the stage-key namespace + 4 builders (stageKey/stageValue*Key + STAGE\_* groups) into `stage-keys.ts`; 10 importers + `types/kosztorys.ts` repointed. `constants.ts` is now pure value defaults.
- [x] dismissed · structure-scatter · (branch-wide) · no scatter introduced; branch CONSOLIDATED the two flat-root kosztorys specs into `src/__tests__/lib/kosztorys/`.

### Tailwind (all pre-existing shadcn ui/\* — not introduced by this branch)

- [x] skipped · tailwind · `ui/select.tsx:59` min-w-[8rem], `ui/textarea.tsx:10` min-h-[68px], `ui/calendar.tsx:79,85` text-[0.8rem] · pre-existing shadcn defaults, out of this refactor's scope.
- [x] dismissed · tailwind · checkbox.tsx rounded-[4px], select.tsx z-[10001], editor-body.tsx calc(100dvh) · legit runtime/one-off arbitrary values, keep. EX-514 ring-3 confirmed complete.

### Comment noise (applied in the /simplify step)

- [x] fixed · comment-noise · `discount-edit.ts:14,23` · deleted 2 restatement comments.
- [x] fixed · comment-noise · `kosztorys-v2-column-opts.ts:46` · deleted — restated the typed field.
- [x] fixed · comment-noise · `kosztorys-section-summary.tsx:45` · deleted — restated editId/draft.
- [x] fixed · comment-noise · `delete-policy.ts:12` · trimmed to the invariant clause.
- [x] fixed · comment-noise · `row-view.ts:3` · trimmed to "parity with v1".
- [x] fixed · comment-noise · `kosztorys-v2-columns.tsx` withResize comment · deleted — restated body + named a STALE field (onResizeColumn).

## Simplify pass

Ran /simplify — 2 applied, 0 proposed, 0 dismissed; each folded into ## Findings (tagged simplify below). Reuse/efficiency angles came back clean.

- [x] fixed · simplify · `row-ops.ts` applyRestoreItem · replaced the IIFE-in-ternary with an early return for the null case; flat anchor lookup.
- [x] fixed · simplify · `cells/section-name-cell.tsx` · narrowed the prop from the whole `BuildV2ColumnsOptsT` bag to `onRename?: (sectionId, name) => void` — removes the leaf cell's upward dependency on the column-opts module.

## Tests & suite

- typecheck: PASS (`tsc --noEmit` clean)
- unit (kosztorys + utils): PASS — 141 passed / 11 skipped (DB-dependent), then 50 passed on the two touched specs after the /simplify edits.
- lint / e2e / build: not run in this gate (working-tree refactor; full suite runs at PR merge).
