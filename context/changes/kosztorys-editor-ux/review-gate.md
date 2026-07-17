# Review-gate ledger — kosztorys-editor-ux · 2026-07-13

Unit of work: 10x change `kosztorys-editor-ux` — branch `dogfooding/kosztorys-editor-ux`,
22 commits over `origin/main` (base `7619331`).

Surviving checks (fan-out): `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Dropped: `/10x-impl-review` — no `plan.md` (umbrella change plans each item separately).

Step 0.5 (browser verification): satisfied by the dogfooding session (fixes committed into the
reviewed diff). Its still-open verify-by-hand items are folded into `## Findings` below as
`verify` and gate manual sign-off at Step 4.

## Findings

<!-- ONE checkbox per finding. [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

### Correctness — code-review (native severity, test disposition)

- [x] 🟡 WARNING · fixed · code-review · `lib/actions/kosztorys.ts` (addItemAction + addSectionAction) · append derived next order from `count.totalDocs`, not `MAX+1`; `removeItemAction` doesn't renumber, so delete-then-append **deterministically collided** on `display_order`. Fixed: both now `SELECT COALESCE(MAX(display_order)+1,0)` (items scoped by `section_id`, sections by `investment_id`).
      test: test-driven-debugging · integration — `kosztorys-create-order.test.ts` CR1: add 3 → delete middle → append; RED asserted 2 distinct orders, GREEN asserts 3 distinct + new = max+1. ✓
- [x] 🟡 WARNING · fixed · code-review · `lib/actions/kosztorys.ts` (seedBlankSectionAction) · no server-side "kosztorys empty" guard — not idempotent under double-submit/stale client. Fixed: `count>0 → bail` no-op guard before the seed (leaves `seed-blank.ts` hardcoded `displayOrder:0` correct, since it now only ever runs on an empty investment).
      test: test-driven-debugging · integration — `kosztorys-create-order.test.ts` CR2: seed twice; RED asserted 2 sections, GREEN asserts section+item counts stay 1. ✓
- [x] 🔵 OBSERVATION · deferred · code-review · `kosztorys.ts` (insertItemAction) · raw `UPDATE …+1` shift + `payload.create` not in one transaction, no `FOR UPDATE` — concurrent-insert race, low likelihood, non-atomic. **Filed EX-464.**
      test: no automated test (nondeterministic race) — disposition recorded in the issue.
- [x] 🔵 OBSERVATION · deferred · code-review · `kosztorys.ts` (insertItemAction/addItemAction) · no check that `sectionId ∈ investmentId` (`protectedAction` gates auth only); pre-existing pattern, newly exercised by ⋯-menu insert. **Filed EX-465.**
      test: integration (reject mismatched section/investment) — recorded in the issue.
- [x] 🔵 OBSERVATION · deferred · code-review · `kosztorys-editor-body.tsx` · grid remount key encodes `sorted|natural`, not which field → stale sort arrow persists when re-sorting a 2nd column; pre-existing. **Filed EX-466.**
      test: e2e (active arrow follows the sorted column) — recorded in the issue.

### Structure / style (tag-free — no test disposition)

- [x] fixed · simplify · `kosztorys-editor-body.tsx:84` · `grid-cols-[minmax(0,1fr)]` → `grid-cols-1` (identical computed track) + comment updated to match.
- [x] deferred · module-cohesion · `lib/kosztorys/v2-rows.ts` · move `rowDoneNetForView` → `calc.ts` — NOT mechanical: it uses `stageKey` (a v2-rows helper), so a clean move needs relocating `stageKey` too to avoid a `calc↔v2-rows` cycle → larger refactor. **Filed EX-467.**
- [x] fixed · simplify · `lib/kosztorys/v2-rows.ts:157` · moved `NEW_SECTION_DEFAULTS` → `constants.ts` (zero internal v2-rows use; 4 import sites re-pointed; `CostVariantT` type added to constants). Typecheck green.
- [x] fixed · simplify · `lib/tables/kosztorys-v2-columns.tsx:334` · deleted comment (narration + factually-wrong "48px", actual `64`).
- [x] fixed · simplify · `kosztorys-actions-menu.tsx:19` · trimmed narrating intro, kept the focus-fight why.
- [x] fixed · simplify · `kosztorys-row-actions-menu.tsx:42` · trimmed first sentence (dup of `sortActive` doc), kept the pointer-events/tooltip why.
- [x] dismiss · comment-noise · `lib/tables/kosztorys-v2-columns.tsx:125` · `title()` one-liner restates its two branches — weak, but a fair summary for a vaguely-named fn. Keep, not worth churn.
- [x] dismiss · comment-noise · `use-kosztorys-editor.ts:208` · `handleInsertItem` opener narrates, but the load-bearing whys (sort no-op, denormalized fields) sit right after. Keep.
- [x] dismiss · comment-noise · `empty-kosztorys-dialog.tsx:14` · `onCreated` "refresh + remount" conveys cross-component behavior the name alone doesn't. Keep (file is temp anyway).
- [x] deferred · structure-scatter · `lib/tables/kosztorys-v2-columns.tsx` · pre-existing home-of-one for datasheet-grid column defs vs `components/tables/` (react-table); slice added **zero** new scatter (file only modified). Consolidation is a separate refactor. **Filed EX-468.**
- [x] dismiss · feature-first · `components/kosztorys/cell-select-menu.tsx` · genuinely generic grid primitive but single consumer; keep in feature, promote to `components/ui/` when a 2nd datasheet grid appears.
- [x] dismiss · feature-first · `components/dialogs/` vs feature-colocated · this slice's dialogs colocated (the more-correct tier); the pooled-dialogs inconsistency is pre-existing (overlaps the scatter item) — no change to these files.

### From the dogfooding log (verify / parking-lot — pre-existing, folded in)

- [ ] verify · dogfooding · `kosztorys-row-actions-menu.tsx` · ⋯ menu insert/move/delete + sort-disabled behavior — never signed off by hand (log §7 checkboxes). Blocks manual sign-off (Step 4).
- [x] deferred · dogfooding · `kosztorys-editor-body.tsx` · column-resize `guideX` line shares the transform/fixed containing-block latency (vertical, less visible) — parking lot. **Filed EX-469.**
- [x] deferred · dogfooding · `kosztorys-v2-columns.tsx` · Brutto column placement (far-right) — pin next to Netto / sticky end-column vs leave in-flow. Now always-visible → decision. **Filed EX-470.**
- [x] deferred · dogfooding · `kosztorys-editor-body.tsx` · grid virtualization repaint flicker on delete (§6) — cosmetic. **Filed EX-471.**

## Simplify pass

Applied 5 cleanups directly (folded into ## Findings, no separate report): TW1 `grid-cols-1`,
MC2 `NEW_SECTION_DEFAULTS`→`constants.ts` (4 imports re-pointed), CN1 delete stale comment,
CN2/CN3 comment trims. `pnpm typecheck` green. MC1 (`rowDoneNetForView`→`calc.ts`) downgraded to
defer — the clean move needs `stageKey` relocation (cycle avoidance), larger than mechanical.

## Tests & suite

<!-- one line per leg, or "deferred by user" -->

- [x] CR1+CR2 integration — `src/__tests__/lib/actions/kosztorys-create-order.test.ts`, 2 tests, RED→GREEN vs dev DB (5433). ✓
- [x] E2E (⋯-menu add/insert/delete + order integrity) — **deferred, filed EX-472** (`e2e-backlog`). DL1 hand sign-off stays owed → slice ships **in review**, not archived.

### Full suite (user: run now)

- typecheck ✓
- lint ✓ (0 errors, 87 pre-existing warnings — migration scaffolds)
- test (unit) ✓ — 847 passed, 31 skipped (0 failures)
- test:integration ✓ — 12 files / 30 tests passed vs 5435, incl. `kosztorys-create-order.test.ts` (2) in-harness
- test:e2e ⚠️ — 2 passed, **2 pre-existing failures** (`transfer-create.spec.ts:9`, `transfer-cancel.spec.ts:12`), **not this slice**. Isolation re-run also failed both but at a _shifting_ step (run 1: `helpers.ts:91` popper-detach; run 2: `helpers.ts:133` Dodaj submit) → flaky-under-load in the transfer expense-form Radix/cmdk combo helper. Proven out-of-scope: branch changed **0** files under `e2e/` and **0** shared UI/combo/popover/form primitives (`git diff 7619331..HEAD`). Kosztorys e2e untouched by the slice. **Filed EX-473** (pre-existing, tracked separately).
- build ✓ — `generate:importmap` + `generate:types` + `next build` clean, full route tree emitted.

## Gate outcome — IN REVIEW (not archived)

Slice-owned work is complete and green: CR1+CR2 fixed with RED→GREEN integration coverage (in-harness vs 5435), 5 simplify cleanups applied, 12 findings deferred+filed (EX-464…EX-472), suite green on every slice-relevant leg (typecheck/lint/unit/integration/build). The only non-green leg (test:e2e) is 2 **pre-existing** transfer-spec failures proven outside this slice (0 e2e/shared-primitive changes on the branch), filed EX-473.

**One open box blocks archive:** DL1 — the ⋯-menu insert/move/delete + sort-disabled **hand sign-off** (human-owned; its automated form was deferred as EX-472). Archive (`/10x-archive`) stays blocked until a human signs off DL1. → **status: in review.**
