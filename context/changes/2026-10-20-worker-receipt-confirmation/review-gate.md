# Review-gate ledger — worker-receipt-confirmation · 2026-10-20

Scope: `05b6d8911..dc9391f9e` (p1–p5 + epilogue), merged into local `staging` as `e1023ed62`.
Verification pass (browser) skipped — not requested this run; manual checks stay in the registry.

## Findings

- [x] 🔵 OBSERVATION · filed · `e2e-backlog` · browser-level slice owes its E2E (worker confirms/rejects a transfer and a wpłata; management sees the rejection) — filed EX-1121
      test: e2e — deferred into EX-1121
- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/components/receipt-confirmation/receipts-to-confirm.tsx:10` · imported a nonexistent `receipt-status-badge` module — now `payout-status-badge`
      test: no automated test · unit — typecheck and the DOM spec `receipts-to-confirm.test.tsx` cover the import
- [x] 🟡 WARNING · skipped · code-review · `src/lib/auth/roles.ts:88-90` · any MANAGER may now cancel any rejected transfer or wpłata, an OWNER's „Zasilenie z konta firmowego" included — follows the carried-over ruling („Anuluj" cancels a rejected receipt); narrowing changes what a user may do, so raised with the user instead of applied
      test: no automated test · unit — no behaviour change made
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/collections/hooks/transfers/payout-status-default.db.test.ts` · stamp specs missed the CHECK refusal on a non-money-in type and a „Pracownicze" kasa — both added
      test: TDD · integration — persisted `payout_status` and the violated constraint name
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/migrations/20261020_1_receipt_status_on_money_in.ts:11` · CHECK type list can drift from `carriesPayoutStatus` — drift spec reads `pg_get_constraintdef` and compares it with the predicate over every type
      test: TDD · integration — drift guard in `payout-status-default.db.test.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/receipts/` · „receipt" collided with paragon (worker-expense-drafts) — dir renamed to `receipt-confirmation/`, type to `RejectedReceiptConfirmationT`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/receipt-confirmation/rejected-receipts.tsx` · renamed column ids would reset managers' saved column state — kept `workerName` / `sourceRegisterName`
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/actions/transfers.ts` · push read-back ran outside a try/catch — wrapped, logged with a `TODO(EX-958) SENTRY-REQUIRED` marker
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/migrations/20261020_1_receipt_status_on_money_in.ts:4` · header didn't say `down()` erases non-PAYOUT answers — now does
- [x] 🔵 OBSERVATION · fixed · impl-review · stale comments, `badges-section.tsx` source path, `roles-inventory.md` wording and line refs — updated
- [x] 🔵 OBSERVATION · dropped · impl-review · `plan.md` Phase 1 names `RECEIPT_STATUSES` and a file that never shipped — plan scaffolding, distilled away at archive
- [x] 🔵 OBSERVATION · dismissed · impl-review · „Odrzucono" column header isn't in the approved copy — neutral copy per the "no wypłata" wording rule
- [x] 🔵 OBSERVATION · dismissed · code-review · deploy order on non-prod DBs — informational; additive migration, migrate before push
- [x] 🔵 OBSERVATION · dismissed · code-review · „Kasa" column is the paying kasa for a wypłata and the receiving kasa otherwise — a wypłata showed its source kasa before too
- [x] 🔵 OBSERVATION · dismissed · code-review · a deactivated (not trashed) worker's kasa still gets a stamp he can't answer — the status gates nothing
- [x] dropped · structure-scatter-audit · `src/lib/queries/pending-receipts.ts` · name stem differs from `receipt-confirmation` — not worth the churn
- [x] fixed · comment-noise-audit · slice files · narrating / history comments — deleted or trimmed
- [x] dismissed · suite · `.next-e2e/types/validator.ts:323` · typecheck error on a stale generated artifact outside the slice
- [x] fixed · simplify · `src/lib/actions/settle-payouts.ts:108` · settle built push recipients in memory while transfers read the stamp back — both now call `notifyCreatedReceipts` (`lib/push/notify-created-receipts.ts`)
- [x] fixed · simplify · `src/lib/db/receipt-confirmation.ts:140` · hand-rolled `IN (…)` list — `sqlList`; read-back ordered by id
- [x] fixed · simplify · `src/lib/db/receipt-confirmation.ts:43` · `sameOwner` ternary + `NOT (…)` — one `IS DISTINCT FROM` predicate
- [x] fixed · simplify · `src/lib/constants/transfers.ts:387` · `DEPOSIT_TYPES.includes` cast — `isDepositType` (widened to `unknown`)
- [x] fixed · simplify · `src/collections/hooks/transfers/validate.ts:68` · `type === 'REGISTER_TRANSFER'` twice — one `needsTargetRegister` destructure
- [x] skipped · simplify · `src/collections/hooks/transfers/validate.ts:64` · receiving-kasa rule lives in the hook (TS, in-flight data) and in the `RECIPIENT` SQL fragment — sharing it needs a synthetic `VALUES` row; stamp and decide specs pin both sides, review-worthy refactor
- [x] dropped · simplify · `payoutStatus` / `carriesPayoutStatus` / `payout-pending` keep the "payout" stem under "receipt" modules — column rename needs a migration; partial predicate rename buys little
- [x] dropped · simplify · `src/collections/hooks/transfers/validate.ts:79` · one owner lookup per row in a bulk wpłata — ~1–3 ms per row at this scale
- [x] dismissed · simplify · `src/lib/db/receipt-confirmation.ts:167` · `listRejectedReceipts` recomputes the receiving kasa — inlining would re-duplicate the `RECIPIENT` rule; few rows
- [x] dropped · simplify · `src/__tests__/lib/db/receipt-confirmation.db.test.ts:48` · `bookMoneyIn` union could be a plain `Pick` — test-only cosmetic
- [x] dropped · simplify · `src/__tests__/lib/db/receipt-confirmation.db.test.ts:139` · per-owner cleanup loop vs `purgeFixtureUsers` — pre-existing pattern, the diff only added one owner

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude agents) — 5 applied, 0 proposed, 6 skipped/dropped/dismissed; each finding folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- typecheck — clean apart from the stale `.next-e2e/types/validator.ts` artifact (dismissed above)
- lint — 0 errors; 47 pre-existing warnings, none in slice files
- DB specs (payout-status-default, receipt-confirmation, transfers, settle-payouts, shell-badge-counts) on a freshly rebuilt `db-test` — 5 files, 53 passed
- unit / DOM specs (receipts-to-confirm, unread-badge, receipt-confirmation actions, constants/transfers, notify-pending-receipts, push-client, transfer-text) — 7 files, 509 passed
- full `pnpm test`, E2E, build — not run (not requested; E2E filed as EX-1121)
