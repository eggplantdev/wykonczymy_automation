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

_Trimmed at archive (2026-10-12): 18 fixed findings removed; their record is the commits. Dismissed / dropped / filed kept._

- [x] 🔵 OBSERVATION · skipped · impl-review · `verify-rejected-payout-dialog.tsx` · hide „Anuluj” unless the viewer created the wypłata — behaviour change the plan rules out (no client gate beyond the server's)
- [x] dismissed · comment-noise · action schema comment — documents the deliberate coupling to the cancel-reason limits
- [x] dismissed · tailwind-v4-audit · `break-words` / amber border — valid v4, no token exists for the accent
- [x] dismissed · structure-scatter · `components/payouts/` vs `payout-confirmation` slugs; shared `CANCEL_REASON_*` limits — one feature dir, one deliberate limit
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
