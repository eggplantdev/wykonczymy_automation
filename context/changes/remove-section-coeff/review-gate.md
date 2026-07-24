# Review-gate ledger — remove-section-coeff · 2026-07-24

Slice: drop per-section subcontractor coeff tier + explicit labeled section sidebar buttons.
Own commits: c9e0f248 (p1) · 4e4b4642 (p2) · 9982da71 (p3) · cf79a49e (p4) · 40cd9a60 (epilogue) · 9e13c56a (relabel).
Interleaved investments/status-filter commits are OUT of scope.

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] fixed · simplify · `src/lib/kosztorys/calc.ts:38` · deleted effectiveCoeff doc comment that restated name+signature after the section-override WHY was gone.
- [x] fixed · simplify · `src/components/ui/decimal-field.tsx:15` · narrowed `onCommit` to `(n: number) => void` (null provably unreachable — commit no-ops on empty), and cleaned the 5 now-dead null guards in callers (global-settings ×2, summary-settings-bar VAT + discount `?? 0`, summary-expenses-tab). tsc+lint green.
- [x] dropped · module-cohesion · `src/components/kosztorys/editor/kosztorys-sections-drawer.tsx` · `KosztorysSectionSummary` export-name drift — predates slice, still shows per-section net; rename-to-convention not worth churn here.
- [x] dismissed · tailwind-v4 · slice `.tsx` files · clean — the two pre-v4 hits in kosztorys-editor-body.tsx are outside this slice's diff.
- [x] dismissed · structure-scatter · `src/migrations/20260724_1_*.ts` · new migration lands in established home + registered in index.ts — no scatter.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `kosztorys-sections-drawer.tsx:52` · F1 header „Widok sekcji"→„Pokaż / ukryj sekcje" beyond plan's "not restyling" line — intentional relabel (commit 9e13c56a), benign copy improvement.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `plan.md` Phase 3 · F2 plan paths stale post-EX-515 split — impl mapped every edit onto renamed files correctly; plan-accuracy note, no code defect.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `kosztorys-sections-drawer.tsx:118` · F3 delete button always `text-destructive` vs plan's hover-only — standard treatment for a labeled destructive button; accepted design choice.
      test: no automated test · — cosmetic affordance, eyeball in the manual pass (covered by sidebar-buttons check).
- [x] 🔵 OBSERVATION · fixed · code-review · `context/foundation/manual-checks.md:944` · deploy note gave ADD ordering ("migrate before code") for a column DROP — reversed to code-first + explained the Payload-ORM missing-column 500 window.
      test: no automated test · — deploy-sequencing doc fix, not unit-testable.
- [x] 🔵 OBSERVATION · dismissed · code-review · `migration down` · re-adds `w_tools_coeff`/`own_tools_coeff` as nullable numeric no-default — exact structural reversal of the original Payload `type:'number'` fields; data loss acceptable (throwaway). Benign.
- [x] dismissed · code-review · `calc.ts` / `v2-rows.ts` / `types.ts` · effectiveCoeff collapse + denorm removal complete and in lockstep; grep confirms zero section-tier reads in `src`. Correct.
- [x] dismissed · code-review · `decimal-field.tsx` · `nullable`/null-commit removal behavior-preserving — sole nullable caller (section-coeff popover) deleted; 4 surviving callers never passed nullable, already no-op'd on empty.
- [x] dismissed · code-review · `queries/kosztorys.ts` · sections via Payload ORM not raw SQL → no stale hand-written SELECT; JS mapping removal sufficient.
- [x] dismissed · code-review · repo-wide · all surviving `wToolsCoeff`/`ownToolsCoeff` are the global/investment tier (intentionally kept) or autogen payload-types.ts. No half-removed reference.
- [x] dismissed · verify · sidebar checks 1–5 · all PASS against 5435 test DB (perf-seed inv 7, OWNER) — stacked labeled buttons, add-item-to-section, delete-section confirm+cascade, rename persist, no coeff popover + global coeff/per-item override reprice intact. Registry 5 boxes ticked.
- [x] dismissed · verify · env artifacts · stale-session FK on first delete (fixed by fresh login) + intermittent Turbopack lucide-barrel ReferenceError in `.next-e2e` cache — both environment, source clean. No test owed.

## Simplify pass

Ran /simplify (focused, not 4-agent fan-out — slice diff is small + near-all-deletion, reuse/cohesion/scatter already audited in Step 1): 2 applied (comment-noise `calc.ts:38`, decimal-field `onCommit` narrowing + 5 dead-guard cleanups), 0 proposed, 0 dismissed. Each folded into ## Findings tagged simplify. No separate report file. primitive-reuse-scan not separately run — slice adds one new file (a migration in its established home); no hand-rolled primitives (reuse angle covered by structural audits).

## Tests & suite

- No new tests owed: 0 correctness bugs from either bug-finder + verify; `effectiveCoeff` collapse already covered by the kosztorys unit suite (updated in p4).
- No new E2E owed: slice relabels pre-existing section-CRUD buttons + removes coeff popover — no new multi-boundary user flow; covered by unit tests + the manual verification pass (registry 5 boxes ticked).
- `pnpm typecheck` — green (post-/simplify).
- `pnpm lint` — 0 errors (87 pre-existing warnings in old migrations, unrelated).
- `pnpm exec vitest run src/__tests__/lib/kosztorys` — 234 passed / 11 DB-skipped (no ENV_READY).
- Full suite (test:e2e / build) — user chose **fast legs only**; the fast legs (typecheck / lint / kosztorys unit) are green this session. e2e/build not run.
