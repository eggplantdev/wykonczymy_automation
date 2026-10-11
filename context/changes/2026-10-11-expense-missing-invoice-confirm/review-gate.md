# Review-gate ledger — expense-missing-invoice-confirm · 2026-10-11

Base `f09580cad` (staging tip); worktree `wykonczymy-worktrees/expense-missing-invoice-confirm`.
Step 0.5 (browser verification) skipped — no browser pass unprompted; manual checks live in
`context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · `useManagedForm` was rebuilt on `useSubmitConfirm`, but no manual check covered the investment form's red „Zakończyć inwestycję?" — line added next to the deposit „Bez zmian" check
      test: no automated test · — existing `use-managed-form.test.tsx` already pins the hook; the line covers the rendered form
- [x] 🔵 OBSERVATION · skipped · code-review · `src/components/forms/expense-form/expense-form.tsx:241` · a receipt scan landing while the confirm is open saves the click-time snapshot — pre-existing (a mid-scan save always saved the snapshot); both fixes (block save while `isGenerating`, or re-read `form.state.values` after the answer) change what the user can do, so surfaced rather than applied
      test: no automated test · — not fixed
- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/drivers/expenses.ts:75` · the driver clicked „Zapisz bez faktury" unconditionally, so a refused submit timed out on that button instead of naming the field errors — now waits for the confirm OR a field error, whichever comes first (efficiency review: the interim fixed 10 s wait also hid a missing confirm)
      test: no automated test · e2e — the driver IS the test harness; exercised by every `createInvestmentExpense` caller
- [x] 🔵 OBSERVATION · dismissed · code-review / impl-review F2 / feature-first · `src/lib/transfers/missing-invoice-confirm.ts:1` · `lib` imports a type from `components` — type-only, erased at build, precedent in `lib/actions/*` and 3+ other `lib` files
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/transfers/transfer-table-server.tsx:25` · `skipMedia` would hide invoices from the edit form's check — unreachable, no table config excludes `invoice`
- [x] 🔵 OBSERVATION · dropped · impl-review F3 · `src/components/forms/expense-form/expense-form.tsx:482` · `ConfirmDialog` rendered inside `<form>` — portaled, no behavioural difference
- [x] 🔵 OBSERVATION · dismissed · impl-review F4 · `change.md` · status still `implementing` — moves to `implemented` once the touched specs are green
- [x] fixed · code-review · `src/lib/transfers/missing-invoice-confirm.ts:17` · parallel boolean array → `rowsWithInvoice: { has(index) }`; ExpenseForm passes the `positionalFiles` Map it already builds
- [x] fixed · structure-scatter · `src/components/forms/hooks/use-submit-confirm.ts:6` · `SubmitConfirmCopyT` re-declared the `variant` union — now a `Pick` of `ConfirmDialog` props
- [x] fixed · comment-noise · `missing-invoice-confirm.ts`, `use-submit-confirm.ts`, `e2e/drivers/expenses.ts` · deleted the `missingInvoiceConfirm` doc comment, trimmed the hook doc's restating first sentence, driver comment now says why
- [x] fixed · simplify · `src/components/forms/hooks/use-submit-confirm.ts:31` · `dialogProps` copied every copy field by hand, a second sync point next to the `Pick` — now spreads `asked?.copy`
- [x] fixed · simplify · `src/__tests__/helpers/expense-form.ts` · `referenceData` + `valuesWith` were in their third copy (prefill, duplicate-mark, missing-invoice) and already drifting — extracted `expenseReferenceData` / `expenseValues`; the `vi.mock` blocks stay per spec (hoisting)
- [x] fixed · simplify · `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:100` · the ingest refusal sat inside `submit`'s action, after the new question, which forced a `!isIngesting` term into the missing-invoice check — moved to the top of `onSubmit` as in ExpenseForm (same `warning` toast), term and dead in-action guard removed
- [x] dropped · simplify · `e2e/invoice-ingest.spec.ts:147` · the „Zapisz bez faktury" locator is spelled out beside the driver's — one label in two places, not worth a helper
- [x] skipped · simplify · `src/components/forms/form-components/form-footer.tsx:18` · `awaitingAnswer={x.open}` beside `<ConfirmDialog {...x} />` is a pairing every form must remember (4 forms) — a `confirm` prop on FormFooter would own both, but it is a refactor of a pre-existing prop across deposit/investment forms and moves their dialogs into the `<form>` React tree (synthetic events bubble through portals); this slice only reuses the existing prop
- [x] dropped · simplify · `src/lib/transfers/missing-invoice-confirm.ts` · moving the `isInvestmentExpense` check into the lib functions — consistency only between two callers whose inputs legitimately differ
- [x] skipped · simplify · `src/lib/transfers/missing-invoice-confirm.ts:4` · „Ta pozycja…" vs „Ta transakcja…" forces a description-less base copy — unifying the wording is an owner's call, not a cleanup
- [x] dismissed · simplify · `src/components/forms/expense-form/expense-form.tsx:239` · `positionalFiles` now built before the question — one small Map per submit, needed by the check anyway

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 4 applied, 2 skipped, 2 dropped,
1 dismissed; each finding folded into ## Findings (tagged `simplify`). `primitive-reuse-scan` ran
inside the reuse agent (grep-based, no catalogue subagent) — no reinvented primitive in production
code. Clean on module-cohesion (6 dismissed), feature-first, structure-scatter (diff-scoped);
impl-review verdict APPROVED.

## Tests & suite

- Touched specs (7 files, 35 tests): `missing-invoice-confirm`, `use-submit-confirm`, `use-managed-form`, `expense-form-missing-invoice`, `expense-form-prefill`, `expense-draft-duplicate-mark`, `edit-transfer-form-missing-invoice` — all green.
- `pnpm typecheck` — clean (after `generate:importmap`; the gitignored Payload import map was missing in the worktree).
- `pnpm lint` — 0 errors; 85 pre-existing warnings, none in this slice's files.
- Prettier — 3 files reformatted (layout only).
- Full unit suite and E2E — not run, per user (touched specs only).
