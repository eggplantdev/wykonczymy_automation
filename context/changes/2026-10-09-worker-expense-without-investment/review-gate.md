# Review-gate ledger — worker-expense-without-investment · 2026-10-09

Scope: `94c7c6c8a..1162d11fa` (p1–p4 + epilogue), `src/**` only. Verification pass (Step 0.5) skipped —
the user verified the flow by hand on :3000.

## Findings

- [x] fixed · `suite` · 11 existing specs (`dashboard-aggregation`, `default-cash-register`, `transfer-table`, kosztorys stage/sheet/summary, …) · typecheck red: `WorkerRefT` / worker-form input gained a required `canAddExpensesWithoutInvestment`, fixtures lacked it — added `false` beside each `language: null`
      test: no automated test — typecheck is the guard
- [x] fixed · `impl-review` · `plan.md` § Progress · rows 1.3, 2.1–4.2 unticked — specs ran green, ticked
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/worker-expenses/expense-draft-dialog.tsx:117` · an investment pick kept from the last send survives a refresh that took it away (flag cleared) and „Wyślij" still counts it — reset on reopen
      test: test-driven-debugging · unit (DOM) — `expense-draft-dialog-no-investment.test.tsx` „drops the pick kept from the last send…"
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/components/worker-expenses/delete-expense-draft-button.tsx:15` · leftover nullable `investmentName` prop — back to `string`
      test: no automated test — type-level, the compiler is the guard
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:238` · reject confirm hard-coded „Bez inwestycji" — reads `pl.expenseDrafts.noInvestment`
      test: no automated test — same string, one source
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/migrations/20261009_3_worker_expense_without_investment.ts:16` · `down` loses more than its comment said — comment names the pages and the unlinked transfer
      test: no automated test — comment only
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `plan.md:390, :429` · doc drift (dialog paths, uk/ru strings, action spec path) — amended
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/lib/actions/worker-expense-drafts.ts:56` · update answers `chooseInvestment` for a decided/foreign draft — as planned; the decided/foreign case is refused either way, the message is cosmetic
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/components/worker-expenses/draft-prefill.ts:57` · prefill can put an inactive worker in a hidden buyer field — the booking is correct; the buyer IS that worker
- [x] 🔵 OBSERVATION · skipped · `impl-review` · `src/components/tables/expense-drafts.tsx:37` · an accepted no-investment draft's amount never links to its OTHER transfer — new navigation with no obvious target; product call, not a defect
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/components/worker-expenses/draft-prefill.ts:68` · a row added by hand on acceptance gets no default buyer — needs a new prop through the shared ExpenseForm/LineItemsField; rare, and the picker is visible
- [x] 🔵 OBSERVATION · dismissed · `code-review` · management history filter · no „Bez inwestycji" filter option — owner decided „column only"
- [x] fixed · `comment-noise-audit` · dialog:43, DAL:623, actions:33, worker db-test:272, dialog test:108, `draft-prefill.ts` JSDoc, migration lines 4–5 · restating / vanished-state comments — trimmed
- [x] fixed · `simplify` · `src/lib/actions/worker-expense-drafts.ts:56` · flag gate duplicated in both actions outside `findDraftTargetError` — folded in, `draftId` carries the cleared-flag exemption
- [x] fixed · `simplify` · `src/components/worker-expenses/expense-draft-dialog.tsx:69` · option set built twice — one `offeredIds`
- [x] fixed · `simplify` · `src/components/worker-expenses/expense-draft-dialog.tsx:117` · reopen reset skipped the kasa, which goes stale the same way (a lone kasa has no select to fix it) — reset both
      test: test-driven-debugging · unit (DOM) — „drops a kasa kept from the last send once it is gone"
- [x] fixed · `simplify` · `src/lib/db/worker-expense-drafts.ts:251` · redundant `investment_id IS NULL OR` under the LEFT JOIN — reverted
- [x] fixed · `simplify` · action + dialog specs · duplicated fixtures (`noInvestmentDraft`, `sendWithout`, Mokotów+Wola literal) — helpers take `number | null`, `TWO_INVESTMENTS`
- [x] skipped · `simplify` · `expense-draft-dialog.tsx` · derive picks on render instead of resetting on reopen — would empty an edit's pick for an investment he left (behaviour change)
- [x] dropped · `simplify` · NO_INVESTMENT encode one-liner dedup, `investmentName ?? t()` helper, `Promise.all` over gate queries, repeated DAL SQL condition, `it.each` in quick-actions spec — call == body / rare path / churn > gain
- [x] dismissed · `module-cohesion-audit` · worker-gate, draft-prefill, constants, actions, schema, types, dictionaries — each file still one concern
- [x] dismissed · `reuse` · `isSessionAlive`, `FILTER_NONE`, `=== true` coercion, yes/no keys — not the same concept / already reused
- [x] dismissed · `impl-review` · migration `down` data loss — documented, lossy by necessity (NOT NULL)

Pre-existing, not owed by this slice: `src/lib/db/worker-expense-drafts.ts` is 685 lines.

## Simplify pass

Ran /simplify — 6 applied, 0 proposed, 5 dismissed/dropped/skipped; each folded into ## Findings (tagged `simplify`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.sL1kB4jcFV.md`

## Tests & suite

- Red-first: with the reopen reset stubbed out, both new dialog tests fail (2/6); restored → green.
- DOM + node specs (worker-expenses dir, quick-actions, worker-schema, 10 fixture-touched specs): 21 files, 145 passed.
- DB specs @ 5435, `--no-file-parallelism` (worker action + DAL + worker-duplicate-email): 59 passed. A parallel run across the two draft specs fails 7 — shared-DB cross-file interference, the integration leg serialises for exactly this.
- `pnpm typecheck`: clean (was 27 errors, see `suite` finding). ESLint on changed files: 0 errors, 1 pre-existing warning (`transfer-table.test.ts:11`).
- Full suite: not run — user chose touched specs only.
