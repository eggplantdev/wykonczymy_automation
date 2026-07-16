# Review-gate ledger — branch `dogfooding/kosztorys-editor-ux` → staging · 2026-07-16

Unit of work: the **whole branch** vs `main` (base `ba6674e`) — 125 commits, 176 files,
~15.4k insertions, spanning ~20 change folders. Pre-merge gate before staging.

Prior gate: `review-gate.md` (2026-07-13) covered the first 22 commits; its one open box
(⋯-menu manual verify) carries over into `## Findings` below.

Surviving checks (fan-out): `/code-review` (branch diff), `/10x-impl-review` (implemented
slices without a prior per-slice gate: delete-guard, layer-toggle, section-inline-rename,
stages, sections-items), `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit`
(flag-only, diff-scoped).

Step 0.5 (browser verification): **skipped by user decision** — review fan-out only; manual
verification remains a Step 4 close-out blocker (registry has 82 unticked boxes).

## Findings

<!-- ONE checkbox per finding. [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry: test: <test-driven-debugging | TDD | no automated test> · <unit|integration|e2e> — why -->

- [ ] verify · dogfooding (carried from 2026-07-13 ledger) · `kosztorys-row-actions-menu.tsx` · ⋯ menu insert/move/delete + sort-disabled behavior — never signed off by hand. Blocks manual sign-off (Step 4).

### Correctness — impl-review (native severity, test disposition)

- [x] 🟡 WARNING · fixed · impl-review · `use-kosztorys-editor.ts:500` · `handleRenameSection` had no no-op guard → focusing a Sekcja cell + clicking away fired `updateSectionFieldAction` + a full rows patch every time. **Fixed**: bail when `(current sectionName ?? '') === name`, mirroring the already-tested `handleRenameStage` guard.
      test: no automated test · unit — the guard mirrors the DB-tested `handleRenameStage` pattern; the 678-line hook has no renderHook harness and standing one up for a redundant-write guard is disproportionate. Verified by typecheck + parity with the sibling. (Covered incidentally if the hook gets a test harness later — noted in the use-kosztorys-editor split issue.)
- [x] 🟡 WARNING · fixed · impl-review · `kosztorys.ts:315` (removeItemAction) · no pre-delete `captureAutoSnapshot` while section/stage delete both snapshot → plan-only row deleted with no in-session undo. **Fixed** (user-approved): capture an auto snapshot before the allowed delete, mirroring `removeSectionAction`.
      test: test-driven-debugging · integration — `kosztorys-delete-guard.test.ts` case (c2): RED asserted snapshot count stayed 7, GREEN asserts +1 auto snapshot persisted before the plan-only item delete. 6/6 green.
- [x] 🟡 WARNING · dismissed · impl-review · sections-items (S-01) & stages (S-04) plans · code is on `main`, not in this branch's diff — out of scope for this branch's merge gate. BUT their never-recorded manual-verification ledgers + unarchived plans are real doc-debt → captured as a separate ledger note below (not a code blocker for this merge).
- [x] 🔵 OBSERVATION · dismissed · impl-review · delete-guard predicate (stage-progress-only) · verified deliberate + correct — EX-489 made pomiar = Σ etapów and dropped `measured_qty`, so stage check subsumes the old `measured_qty<>0` term. Both planes commented, tests renumbered.
- [x] 🔵 OBSERVATION · dismissed · impl-review · delete-guard last-item cascade (`f8ebc07`) · deliberate drift, better than plan (kills orphaned empty sections); routes through guarded `handleRemoveSection`. Keep.
- [x] 🔵 OBSERVATION · deferred (filed EX-509) · impl-review · `use-kosztorys-editor.ts:328` · blocked-delete server-rejection revert uses `applyAddItem` → re-appends row at end, wrong grid position until reload. Cosmetic, only on already-degenerate predicate-drift path. Filed to EX-509 (grouped with the global-discount revert gap).
      test: no automated test · unit — degenerate path, low value; recorded in EX-509.
- [x] deferred (filed EX-510 + EX-511) · impl-review · delete-guard + section-inline-rename E2E-backlog obligations · filed as two `e2e-backlog` issues: EX-510 (delete-guard blocked-delete) + EX-511 (section inline-rename).

### Correctness — impl-review regression (7 gated slices, later-commit drift)

- [x] 🔵 OBSERVATION · dismissed · impl-review-regression · **7 gated slices clean at HEAD** — global-discount, netto-brutto-select, progress-percent, section-append, stage-values, stages-source-of-truth, toolbar-view-menu. 0 critical / 0 warning. Three observations, all deliberate/closed: (1) global-discount Sekcje-Suma block removed by `c6dc24e` (totals bar is now single surface, invariant holds); (2) progress-counter amounts moved to tooltip by `2e4991a` (math intact); (3) discount-column-hiding invariant transiently broken by `a74abd7`, re-fixed by `4650902` within the branch — closed window. No live regressions.

### Correctness — code-review (whole-branch diff, native severity)

- [x] 🟡 WARNING · dismissed (code) + close-out action · code-review · `seed-from-preset.ts:46` · unconditional `INSERT … kosztorys_stages … ordinal 1` collides with `UNIQUE(investment_id, ordinal)` ONLY when a stale (pre-branch) preset's jsonb still carries stages that `applyPreset` inserts at ordinal 1 → transaction rollback → `createInvestmentAction` swallows it → investment silently created with no kosztorys. **Verified correct-by-construction for fresh presets**: `serialize-preset.ts:24` emits `stages:[]`, so `applyPreset`'s `stages.length>0` block is skipped and line 46 is the only stage insert — no collision. Stale presets are throwaway per AGENTS.md (no shim owed; `ON CONFLICT` would mask a real future bug). → **Close-out action: clear presets saved before commit `cd3b4ab` before the staging merge** (human-run DB step).
      test: no automated test — correct-by-construction post-cleanup; the risk is stale data, not code.
- [x] 🔵 OBSERVATION · deferred (filed EX-508) · code-review · `createInvestmentAction` (seed failure swallowed non-fatally) · ANY seed failure during investment-create yields a silently-empty kosztorys, not just this collision. Pre-existing, out of scope. Filed EX-508 — surface the failure instead of swallowing.
      test: integration (seed throw → action surfaces error / investment not left half-created) — recorded in EX-508.
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys.ts:196` (seedBlankSectionAction) · check-then-act idempotency race (concurrent double-submit → two sections at display_order 0). Same class as the filed seed race, different entry point; throwaway data → cosmetic duplicate not corruption, and the CTA's disabled-while-seeding state blocks the live double-submit window. Accepted.
- [x] 🔵 OBSERVATION · dismissed · code-review · `calc.ts:29` (applyDiscount short-circuit) · offer figure („Wartość przedmiaru netto") shows przedmiar at full list price when a global discount is active. **Already tracked as EX-495** — deliberate + documented (`calc.ts:26-29`, `84-86`); owner's own open "rabat in the offer" question, one-commit revert. Not a regression.
- [x] 🔵 OBSERVATION · deferred (filed EX-509) · code-review · `use-kosztorys-editor.ts:557` (handleGlobalDiscountChange) · failed `updateInvestmentGlobalDiscountAction` never reverts the optimistic discount state → grid shows an unpersisted discount until refresh; breaks the "three surfaces never disagree" invariant on a failed save. Mirrors the accepted `handleVatChange` pattern. Filed EX-509 (fix both revert gaps together).
      test: no automated test (optimistic-revert UI path) — recorded in EX-509.

### Structure / style (tag-free — no test disposition)

- [x] proposed (filed EX-512) · feature-first · `src/__tests__/kosztorys-{axis-checkboxes,layer,money-axis,progress-display,discount-edit}.test.ts` · five new specs for `lib/kosztorys/*` landed flat in `src/__tests__/` while the same branch used the mirrored `src/__tests__/lib/kosztorys/` home for others — consolidate to the mirrored home (mechanical `git mv`). Filed EX-512.
- [x] dismissed · feature-first · `src/components/kosztorys/cell-select-menu.tsx` · flagged as a dedup candidate vs `ui/simple-select.tsx` — the /simplify reuse agent verified it is an **intentional split** (DropdownMenu in-grid menu vs Select toolbar listbox, distinct Radix primitives + a11y); placement is defensible (react-datasheet-grid chrome). No action. (Same conclusion as the simplify-reuse dismissal below.)
- [x] proposed (filed EX-513) · feature-first · `context/changes/blob-backup/blob-snapshot.mjs` · executable Node script in the prose-docs tree; twin `blob-mirror.mjs` correctly lives in `scripts/` — move + update runbook path (low priority). Filed EX-513.
- [x] proposed (filed EX-512) · structure-scatter · `src/__tests__/kosztorys-*.test.ts` (6 flat specs) · same finding as the feature-first test-placement one — merged into EX-512.
- [x] proposed (filed EX-514) · tailwind-v4 · `src/components/ui/select.tsx:34`, `src/components/ui/toggle-group.tsx:54` · `focus-visible:ring-[3px]` → `focus-visible:ring-3` (branch-added lines). Caveat: `ring-[3px]` recurs 9× repo-wide as shadcn stock — fix repo-wide. Filed EX-514.
- [x] skipped · tailwind-v4 · `layout.tsx:37`, `select.tsx:59`, `tooltip.tsx:47` · `z-[10001]`/`min-w-[8rem]`/`rounded-[2px]` etc. — all pre-existing shadcn-stock lines, not branch-authored; out of this slice's scope.
- [x] dismissed · tailwind-v4 · `kosztorys-editor-body.tsx:62` (`calc(100dvh-3.5rem)`) · @theme token candidate, not a mechanical swap or a defect — benign; recurring value could become `--height-under-header` later if desired.
- [x] proposed (filed EX-515) · module-cohesion · `src/lib/kosztorys/v2-rows.ts` · god module (28 exports / 5 topics). Split → settlement.ts / row-ops.ts / row-view.ts; moving `stageKey` out also dissolves the EX-467 cycle. Filed EX-515 (checklist item 1).
- [x] proposed (filed EX-515) · module-cohesion · `src/lib/tables/kosztorys-v2-columns.tsx` · grab-bag (861 lines / 4 kinds). Split HEADER_TIPS / cells / toggles. Filed EX-515 (item 2).
- [x] proposed (filed EX-515) · module-cohesion · `src/components/kosztorys/use-kosztorys-editor.ts` · god hook (678 lines, 6 responsibilities). Split into composed sub-hooks. Filed EX-515 (item 3); also unblocks the EX-509 optimistic-revert test gap.
- [x] proposed (filed EX-515) · module-cohesion · `src/lib/kosztorys/constants.ts` · mixes domain defaults with grid column policy. Split column policy → column-config.ts. Filed EX-515 (item 4).
- [x] fixed · comment-noise · `kosztorys-progress-counter.tsx:35` · DELETE vanished-state+restatement ("Amounts live only in the tooltip now…"). Apply in /simplify.
- [x] fixed · comment-noise · `kosztorys-section-summary.tsx:52` · DELETE restatement of `pendingRemove` type. Apply in /simplify.
- [x] fixed · comment-noise · `kosztorys-versions-drawer.tsx:37` · DELETE restatement of `pendingRestore` type. Apply in /simplify.
- [x] fixed · comment-noise · `ui/confirm-dialog.tsx:28-29` · TRIM — cut prop restatement, keep "replacement for window.confirm" intent. Apply in /simplify.
- [x] fixed · comment-noise · `empty-kosztorys-dialog.tsx:23-24` · TRIM — cut sentence duplicating the TODO(EX-463) directive, keep dead-end rationale. Apply in /simplify.
- [x] fixed · comment-noise · `kosztorys-v2-rows.test.ts:329-330` · TRIM + English-rule: Polish comment, and the "moved from calc.ts" head is vanished-state — cut head, keep EX-489 placement rationale, translate to English. Apply in /simplify.
- [x] dismissed · comment-noise · `header-menu.tsx:20,26` · FLAGGED — "each header styles its own" + "must be DropdownMenuItems" are real contract hints on a generic component; keep.
- [x] dismissed · comment-noise · `kosztorys-section-summary.tsx:49` · FLAGGED — inline-rename state comment is borderline but names the null-means-not-editing convention; keep, not worth churn.
- [x] dismissed · comment-noise · `kosztorys-v2-columns.tsx:95-96` · FLAGGED — "Pozostało reads remaining net" coupling earns its keep; benign.

### Simplify findings (reuse / simplification / efficiency / altitude)

- [x] proposed (filed EX-516) · simplify · `use-layer.ts` + `use-money-axis.ts` + `use-progress-display.ts` (+ fold `use-price-view.ts`) · same `useSyncExternalStore` localStorage-enum store → extract `usePersistedEnum<T>(key, valid, fallback)`. Flagged independently by simplification, reuse, and altitude. Pure extraction, no behavior change. Filed EX-516 (item 1).
- [x] proposed (filed EX-516) · simplify · `kosztorys-v2-columns.tsx:452-460,496-504` + `coeff-field.tsx:19-27` (+ `discount-edit.ts` parse) · 4 copies of "trim, comma→dot, empty→clear, NaN→reject" numeric-input guard → extract `parseDecimalInput(raw)`. Filed EX-516 (item 2).
- [x] proposed (filed EX-517) · simplify(efficiency) · `kosztorys-v2-columns.tsx:590` (`RowActionsCell` → `getRemoveBlockReason` → `planItemRemoval`) · O(visibleRows × totalRows) per render — `[...prevById.values()]` + `sectionItemCount` full-rows scan per visible cell; ~50k iters/scroll on a 1000-row sheet. Fix: hoist a `Map<sectionId,count>` + cached `rows.length`. No behavior change. Filed EX-517 (item 1, strongest).
- [x] proposed (filed EX-517) · simplify(efficiency) · `use-kosztorys-editor.ts:178-179` · `assembleV2Columns` built twice per render; toggle path discards every header node it builds. Filed EX-517 (item 2).
- [x] proposed (filed EX-517) · simplify(efficiency) · `v2-rows.ts:333-335` (`rowTotalQtyDone`) O(stages²)/row · denormalize the stage-sum onto the row. **Behavior-change risk** — not mechanical, needs a deliberate call. Filed EX-517 (item 3).
- [x] proposed (filed EX-517) · simplify(efficiency) · `kosztorys.ts` delete actions (`removeItemAction:323`, `removeSectionAction:212`, `removeStageAction:433`) · fold `investment_id` into the guard SELECT (2 round-trips → 1). Minor. Filed EX-517 (item 4).
- [x] dismissed · simplify(altitude) · `constants.ts:62-86` (`stageValue{Net,Gross,Percent}Key`) · three per-stage key builders could collapse to a `{net,gross,percent}` descriptor map — marginal: declared once, adjacent, commented, not fragile. Altitude agent itself says "only flag if you touch this block." Not worth the churn pre-merge.
- [x] dismissed · simplify(reuse) · `cell-select-menu.tsx` vs `ui/simple-select.tsx` · flagged as candidate dedup — verified an **intentional** split: DropdownMenu (in-grid full-cell menu) vs Select (toolbar listbox w/ typeahead). Different Radix primitives + a11y semantics; SimpleSelect's own doc comment routes in-grid pickers to CellSelectMenu. Clean.

## Simplify pass

Ran /simplify — 0 applied, 6 proposed (all filed to Linear: EX-516 dedup helpers, EX-517 efficiency), 2 dismissed; each finding folded into `## Findings` (tagged `simplify`). All substantive findings are refactor-scale or carry behavior-change risk, so none auto-applied in the pre-staging-merge gate per "change as little code as possible; propose larger refactors separately." The one strong perf finding (O(rows²) action-cell) and the three-way enum-hook dup are the highest-value files. Reports returned inline (no separate file).

**All deferred/proposed findings filed to Linear project "Wykonczymy" (2026-07-16):** EX-508 (createInvestmentAction seed-swallow), EX-509 (optimistic-revert gaps), EX-510 + EX-511 (E2E backlog: delete-guard, section-rename), EX-512 (test placement), EX-513 (blob-snapshot move), EX-514 (tailwind ring-3), EX-515 (god-module splits), EX-516 (dedup helpers), EX-517 (editor efficiency). Note: AGENTS.md's "Wykonczymy v2" tech-debt project does not exist — filed to the sole "Wykonczymy" project per the Backlog section.

## Tests & suite

**Tests authored this gate:** `kosztorys-delete-guard.test.ts` case (c2) — pre-delete auto-snapshot on a plan-only item delete (test-driven-debugging, integration). RED (snapshot count stayed 7) → GREEN (+1 snapshot); 6/6 pass via `node --env-file=.env node_modules/vitest/vitest.mjs run <file>`.

**No further tests owed:** every other correctness finding is either dismissed, deferred+filed with its test disposition recorded in the issue (EX-508 integration, EX-509 UI-revert), or dispositioned "no automated test" (`handleRenameSection` no-op guard — mirrors the DB-tested `handleRenameStage`). The two browser-level obligations are filed as `e2e-backlog` (EX-510, EX-511), not authored here.

**Full suite (user chose static + unit + build; E2E deferred):**

- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — 0 errors, 87 warnings (all `src/migrations/*` unused `payload`/`req`/`db` args, pre-existing Payload boilerplate, not branch-authored). Pass.
- [x] unit suite (`node --env-file=.env node_modules/vitest/vitest.mjs run`) — **989 passed, 2 failed**. The 2 failures (`leads/notifications.db.test.ts`, off-by-one +1) are **not this branch**: `git diff main...HEAD` touches zero leads code, and the file **passes 2/2 in isolation**. Cause = shared 5433 dev-DB cross-contamination between `.db` specs (a known isolation characteristic; the pre-push `test:integration` gate uses the isolated 5435 db-test). All kosztorys specs green. Not a merge blocker.
- [x] `pnpm build` — success (importmap + types + next build; full route table emitted, no errors).
- [ ] `pnpm test:e2e` — **skipped by user decision**; the two owed browser specs are filed as EX-510 / EX-511 (`e2e-backlog`).
