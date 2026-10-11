# Review-gate ledger — worker-payout-confirmation (EX-1042) · 2026-10-11

Scope: uncommitted work on `staging`, base `HEAD` (3622d4942). The tree is shared with other sessions,
so the reviewed set is this change's files only (`modified.txt` + `new.txt` in the session scratchpad).
Excluded as other sessions' work: the `kosztorys-stages` and `inspection-form` specs, the
`pwa-push-notifications` and `investment-transactions-page` change folders, and
`src/scripts/fill-translations-from-catalogue.ts`.

Step 0.5 (browser verification pass) skipped: driving the Playwright browser needs an explicit ask in
the same turn. Both views were checked over HTTP against the dev server (owner `/`, `/wyplaty`;
worker `/pracownicy/74`), and the human manual checks live in `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/app/(frontend)/wyplaty/page.tsx` · „Tryb anulowań” on `/wyplaty` overrode `type` after the audit mapping, so it listed nothing — `buildPayoutFilters` (`lib/queries/transfer-filters.ts`) pins `type=PAYOUT` before the mapping runs
      test: test-driven-debugging · unit — `buildPayoutFilters` spec: `type=DEPOSIT` → PAYOUT; audit → CANCELLATION + `cancelledTransaction.type=PAYOUT`
- [x] 🟡 WARNING · fixed · impl-review · 5435 test DB · lost the migration after another session's re-import — `pnpm test:integration` re-imports and migrates (see Tests & suite)
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · checks missing for Tryb anulowań + 390px card chip, Українська, „Rozlicz wypłaty” booking as pending — three boxes added
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/db/payout-confirmation.ts` · „Zweryfikuj” offered „Anuluj” on a trashed/completed investment — lock message computed in SQL via `lockMessageOf`, dialog shows it instead of the button
      test: no automated test — the server already refuses the cancellation; this is the courtesy gate only
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/payouts/payouts-to-confirm.tsx` · a second tap on „Potwierdzam” while the accept is in flight answered an already-decided wypłata and toasted a false error — row buttons disabled while pending
      test: TDD · dom — „locks the row while its acceptance is in flight”
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/transfers/cards/transfer-card.tsx` · the phone card view never showed the payout status — chip beside the type badge
      test: TDD · dom — `TransferCard payout status` (fails with the chip removed)
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/hooks/transfers/validate.ts` · „complete gate” comment ignored the raw-SQL decision writer — reworded (also in `validate-lock.test.ts`)
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review + module-cohesion · `src/lib/constants/payout-confirmation.ts` · dead export — removed
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/db/payout-confirmation.ts` · `RejectedPayoutT` carried `investmentId`/`createdById` nobody read — dropped
- [x] 🔵 OBSERVATION · skipped · impl-review · `verify-rejected-payout-dialog.tsx` · hide „Anuluj” unless the viewer created the wypłata — behaviour change the plan rules out (no client gate beyond the server's)
- [x] 🔵 OBSERVATION · fixed · impl-review · `PayoutStatusBadge` branch untested — covered by the card spec; relocating it to `transfer-text.test.ts` dismissed (the DOM layer is the cheaper real signal)
- [x] fixed · code-review · accept/reject dialogs · `router.refresh()` after `updateTag` re-fetched what the action response already streamed — removed
- [x] fixed · feature-first + structure-scatter · `src/lib/schemas/payout-confirmation.ts` · single-consumer schema — inlined into the action, file deleted
- [x] fixed · comment-noise · `rejected-payouts.tsx`, `payout-confirmation.db.test.ts` · restating comments — trimmed
- [x] dismissed · comment-noise · action schema comment — documents the deliberate coupling to the cancel-reason limits
- [x] dismissed · tailwind-v4-audit · `break-words` / amber border — valid v4, no token exists for the accent
- [x] dismissed · structure-scatter · `components/payouts/` vs `payout-confirmation` slugs; shared `CANCEL_REASON_*` limits — one feature dir, one deliberate limit
- [x] fixed · simplify · `src/components/payouts/accept-payout-dialog.tsx` · a ConfirmDialog wrapper that needed an `onPendingChange` callback back to its parent — folded into `PayoutsToConfirm`, file deleted
- [x] fixed · simplify · `reject-payout-dialog.tsx` · always-`true` `open` prop and a `setReason('')` reset that ran just before the unmount — removed
- [x] fixed · simplify · `src/lib/db/payout-confirmation.ts` · `isPayoutStatus` fallback to 'pending' on an enum column already filtered by the WHERE — cast, like the sibling mappers
- [x] fixed · simplify (altitude + simplification) · collection, `validate.ts`, `transfer-text.ts`, table cell, card · „only a wypłata carries a status” written as `type === 'PAYOUT'` five times — `carriesPayoutStatus` beside `carriesVatPlane`; cell and card test the status alone (the CHECK guarantees it)
- [x] fixed · simplify (reuse) · `src/lib/queries/payout-confirmation.ts` + 3 sibling worker-page queries · 4th copy of the `/pracownicy/[id]` read gate — `workerPageDb(workerId)` in `lib/queries/worker-page-db.ts`
- [x] skipped · simplify (efficiency) · `src/lib/actions/payout-confirmation.ts` · `['transfers']` expires ~16 cache entries per decision — a narrower tag needs every status reader re-tagged, and one missed reader is a stale status; at ~37 workers deciding a few times a month the recompute is cheaper than that risk
- [x] skipped · simplify (altitude) · `rejected-payouts.tsx` + `listRejectedPayouts` · could be fed `TransferRowT` and `getTransferColumns` — a review-sized refactor against the ruling-3 pinned shape, and the column engine has no include-list
- [x] dropped · simplify (efficiency) · partial index for `payout_status='rejected'` — ~1 ms scan at 4.2k rows
- [x] dropped · simplify · `transfers.tsx` `payoutDecidedAt` repeats one ternary in cell and `printValue` — same shape as `createdAt`
- [x] dropped · simplify · `ReasonField` `counterText` branch in both callers; `payoutNoInvestment` vs `expenseDrafts.noInvestment` — no real saving
- [x] dismissed · simplify · `access.update: () => false` on the three fields beside the hook strip — mirrors the `type` field; REST is refused before the hook runs
- [x] dismissed · simplify · `status === 'rejected' && rejectionReason` — the redundant half reads clearer

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 5 applied, 2 skipped, 3 dropped, 2 dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck (`pnpm typecheck`) — clean
- lint (`eslint` over the slice's files) — clean
- touched specs (transfer-filters, payouts/, transfer-card-columns, validate-lock, payout-confirmation action, transfer-text, worker-report-history-table) — 7 files / 69 tests passed
- integration (`pnpm test:integration`, 5435) — first run 13 files failed on `payout_status does not exist`: a stale schema stamp skipped the re-import after another session reset the DB. Stamp removed, re-import + migrate → 140 files / 790 tests passed
- full `pnpm test`, E2E, `pnpm build` — not run (unit leg covered by the touched specs; build would compete with the running dev server)
