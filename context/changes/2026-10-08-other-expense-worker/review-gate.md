# Review-gate ledger — other-expense-worker (EX-1027) · 2026-10-08

Base `78752fbbd` (merge-base with `staging`) · branch `other-expense-worker`.
Step 0.5 (browser verification) skipped — Playwright only on explicit ask; the registry section carries the manual checks.

## Findings

- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `src/components/forms/expense-form/bulk-expense-form.ts:14-22` · `BulkExpenseFormValuesT` line item had no `worker` key → typecheck/`next build` would fail (`mapLineItem`, `lineItems[i].worker` field name, `makeLineItem` literal) — added `worker: string`
      test: no automated test · — the typecheck gate is the guard (G.1)
- [x] 🔵 OBSERVATION · fixed · impl-review F2 + code-review 2 · `src/lib/actions/transfers.ts:144` · bulk create trusted a per-row worker on any type (a PAYOUT row could redirect the payee via a direct call) — now `hasOptionalWorker(type) ? item.worker : form-level`
      test: TDD · unit — `bulk-transaction.test.ts` „PAYOUT writes the form-level worker into every row, ignoring a per-row one”
- [x] 🔵 OBSERVATION · fixed · impl-review F3 · `src/__tests__/bulk-transaction.test.ts:153` · form-level-worker spec ran on INVESTMENT_EXPENSE, not PAYOUT — rewritten on PAYOUT (same spec as above)
- [x] 🔵 OBSERVATION · skipped · code-review 3 · `src/lib/workers/delete-blocker.ts:25` · a person named as buyer on an Inny wydatek can no longer be trashed („powiązany z danymi (transakcje)”) — consistent with the blocker's purpose (a row still names him) and trashing would orphan the per-worker figure; surfaced to the user, no change
      test: no automated test · — decision, not a defect
- [x] 🔵 OBSERVATION · dropped · impl-review F4 + structure-scatter · `src/components/forms/form-fields/line-items-field.tsx:115` · per-row picker is active-only with its own wording vs `EntityComboboxField` (`activeOrSelected`, `WORKER_COPY`) — a stale pick shows blank only after snapshot recovery + deactivation in between; not worth the per-row plumbing
- [x] fixed · impl-review F5 + code-review 4 · `src/components/dashboard/manager-dashboard.tsx:80` · inline `.map` re-implemented `toOptions` — now `toOptions(referenceDataBase.workers)`
- [x] dropped · code-review 5 · `src/collections/transfers.ts:212` · `typeOf(doc ?? {})` vs sibling `doc?.x` — nit
- [x] fixed · comment-noise · `src/lib/constants/transfers.ts:564` · „optional, and” restated the name — trimmed
- [x] fixed · comment-noise · `src/components/forms/expense-form/bulk-expense-schema.ts:121` · comment repeated the gate's rationale away from the gate — deleted
- [x] fixed · comment-noise · `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:94` · comment credited the form with the server's guard — removed with the gate (see simplify)
- [x] dropped · comment-noise · `src/__tests__/bulk-transaction.test.ts:129` · section banner restates the describe — matches the file's existing banner style
- [x] fixed · simplify · `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:94` · client repeated the server's OTHER-only worker gate — now sends `worker` unconditionally; `updateTransferAction` drops it off OTHER
- [x] fixed · simplify · `src/components/forms/form-fields/line-items-field.tsx:122,179,357` · two parallel optional second-row pickers (helper + inline ternary, two identical `RowSelect` blocks) — one `getSecondRowSelects()` array rendered with `.map`
- [x] fixed · simplify · `src/__tests__/validate-hook.test.ts:192` · „OTHER without worker → passes” duplicated the existing VALID_DATA.OTHER case — deleted
- [x] dropped · simplify (efficiency) · `src/hooks/transfers/validate.ts:112` · an OTHER naming a worker now pays the trashed-worker `SELECT` per row in bulk — bulk PAYOUT already does, N is small
- [x] dismissed · simplify (reuse) · `src/lib/constants/transfers.ts:565` · `hasOptionalWorker` body equals `needsOtherCategory` — separate rules that may diverge
- [x] dismissed · simplify (altitude) · `src/components/forms/expense-form/map-line-item.ts:51` · per-row worker gate redundant with the action — keeps `mapLineItem` uniform with the category gates beside it
- [x] dropped · simplify · `src/__tests__/{bulk-transaction,transfer-actions}.test.ts` · repeated request/original setup in the new specs — matches each file's existing style

## Simplify pass

Ran /simplify (4 angles; reuse incl. primitive-reuse-scan) — 3 applied, 0 proposed, 5 dismissed/dropped; each folded into ## Findings (tagged simplify). No report file — results inline above.

## Tests & suite

- `pnpm typecheck` — clean for this slice. One error remains, inherited from staging, not this diff: `src/__tests__/components/investments/investment-info-fields.test.ts:46` (`notes` not in the `Pick<InvestmentRefT, …>`), introduced by `a64cc4cf5`. (The worktree also needed the gitignored generated `src/app/(payload)/admin/importMap.js` copied in.)
- `pnpm exec vitest run` on the 6 touched specs — 6 files, 691 tests, all green.
- Full suite / E2E — not run (user chose typecheck + touched specs).
