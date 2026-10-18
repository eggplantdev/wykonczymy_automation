# Phase 1 — dead tests (2026-10-18)

Suite at start: 739 specs / 89 592 LOC / 5 387 `it` (`census.sh`).

"Dead" = guards nothing a user path reaches: D1 subject only reachable from tests, D2 pins a
removed/reversed rule, D3 cannot fail by construction. Redundant / low-value → phase 2.

Gate per finding: "which production bug becomes undetectable if this goes?" → "none, because …".

## Findings

- [ ] · D2 · pending test run · `lib/kosztorys/columns/document-column-visibility.ts:15` · legacy array `hidden_columns` branch + `LEGACY_{CLIENT,WORKER}_COLUMNS` + array tests (`document-column-visibility.test.ts:47-65`, `settings-new-column.test.ts:20-22`) — prod `20261015_0` applied, 0 array rows on prod/local/test, no snapshot path writes the column; held because `client-view/settings.test.ts`, `worker-view/settings.test.ts` and `queries/kosztorys-client-view.test.ts` feed arrays as STORED input and need map fixtures — convert with the suite running
- [ ] · D3? · pending test run · `lib/kosztorys/save-lanes.test.ts:110-130` · may survive a `drain` that ignores in-flight tails; settle by mutating `save-lanes.ts:39` once. Worst case redundant with `:200-227`
- [x] · fixed · D1 · `lib/kosztorys/kosztorys-settlement.test.ts:152` · `sumSectionSubtotalsNet` describe + the function — prod uses `subcontractorDueByPlane`; the reduce now lives as `preDiscountNet` oracle in `subcontractor-due-by-plane.test.ts`
- [x] · fixed · D2 · `lib/db/deposit-transactions-where-scope.test.ts` · whole file — 433148257 removed the only filtered caller; `getDepositTransactions(Where)` folded into `getDepositTransactionsForInvestment` (parameterized `investment_id`); live guards stay in `get-deposit-transactions.test.ts`
- [x] · fixed · D2 · `lib/actions/read-expense-draft-receipts.db.test.ts` · two „Jeden wydatek" cases (one-photo, over-8 cap) + the `scan_mode` seed override — reader never reads `scan_mode`, inserts hardcode `one-per-photo`, prod has 0 pending one-invoice drafts and 0 restorable skipped receipts on accepted ones. The multi-photo case stays, re-scoped: it is the only guard that `netAmount`/`invoiceNote` reach the stored read
- [x] · fixed · D1 · `components/ui/upload-button.test.tsx:6-19` · `disabled` prop never had a caller (added and orphaned in e1811c6f6) — prop, branch and comment removed
- [x] · fixed · D3 · `lib/kosztorys/reconciliation.test.ts:155-174` · EX-535 describe fed each figure back as its own counterpart; real guard stays at `:137-139`
- [x] · fixed · D3 · `lib/kosztorys/work-catalogue/catalogue-key.test.ts:53-56` · `catalogueKey(x) === catalogueKey(x)`; `itemKey` line repeated `sheet-import/item-key.test.ts:78`
- [x] · fixed · D3 · `transfer-actions.test.ts:260-270` · two „calls validateSourceRegister" tests — the investment-lock query satisfies `mockDbExecute` anyway; real guard `:382-390`
- [x] · fixed · D2 · `action-utils.test.ts:85-89` · „MANAGER can access any register" — role param removed in b57d7aa27, case = the `:76` path; `:76` retitled
- [x] · fixed · D3 · `lib/google/tab-rows.test.ts:98-102` · asserted the test's own filter (`loadAppTransferRows` no longer exists); stale comment dropped
- [x] · fixed · D3 · `lib/table/leaf-column-ids.test.ts:32` · same pure call on both sides
- [x] · fixed · fixture · 6 DB specs inserted retired `'EMPLOYEE_EXPENSE'` — now `OTHER` (register-pinned) / `PAYOUT` (worker-pinned); both delete blockers are type-agnostic
- [x] · fixed · broken · `components/presets/preset-row-actions.test.tsx` · mocked `trashInvestmentAction`, component calls `trashTemplateAction` since c9b0c202d (EX-1075)
- [x] · fixed · broken · `e2e/work-catalogue.spec.ts:88-107` · „Nadpisz…" labels renamed to „Aktualizuj…" in 369c33920 (EX-1017)
- [x] · fixed · vacuous · `e2e/investment-lock.spec.ts:8` · name „żochowska" ≠ DB „Zochowska" → `not.toContainText` / `toHaveCount(0)` at `:104-107` passed on any name
- [x] · dismissed · `lib/db/shell-badge-counts.db.test.ts:55-61` · early return never fires: db-test holds 15 `notification_reads` rows
- [x] · dismissed · `lib/kosztorys/worker-view/summary.test.ts:90-96` · `payout(null, …)` is real: prod holds 57 PAYOUT rows with no worker
- [x] · dismissed · `transfer-actions.test.ts:392-400` · only guard of the b57d7aa27 ruling (management books from any register)
- [x] · dismissed · `transfer-actions.test.ts:967-977` · guards against a double sheet sync (action + hook)
- [x] · dismissed · `lib/actions/investment-assets.db.test.ts:122-131` · `removeAllInvestmentAssetsAction` parked on purpose (0f4b161a4, EX-862); `2026-09-22-kosz-plikow/plan.md` wires it back
- [x] · dismissed · `e2e/investment-loss.spec.ts:21-22` · ids 137/106 match the dump by name

## Verified not dead

- `buildV2Columns` — test-only facade over live `buildV2Grid`; 17 grid specs test live logic (phase 3: repoint)
- per-stream badge counters — deliberate oracle for `countShellBadges`
- `ai-round.ts`, `translation-fill.ts` — knip false positive, live via `src/scripts`
- skip census: only `lib/ai/extract-receipts-live.test.ts` (opt-in live model)
- test helpers: 0 unused files
- E2E `goto` targets: all routes exist
- leads/, app/, hooks/, fixtures/ and the remaining lib dirs: 0 D1/D2

## Phase-2 notes (collected in passing, unverified)

- `lib/db/sum-transfers.test.ts:426` dup of `:236` sentinel; `:286-380` overlaps `investment-financials.test.ts`; `:19-37` parses a mocked row
- `lib/queries/preview-kosztorys-read.test.ts:35-40`, `worker-kosztorys-read.test.ts:37-42` — role test duplicates unauth case (mock ignores role)
- `lib/queries/cash-registers.test.ts` overlaps `dashboard.test.ts:121`
- `insertCatalogueItems` (`lib/db/work-catalogue.ts:143`) prod-dead since 5599b877b, kept by `work-catalogue-translations.test.ts` seed
- `escapeCell` (`lib/i18n/translation-fill.ts:42`) exported only for `translation-fill.test.ts:61-66` fixtures → move into the spec
- 7 trash action specs repeat EMPLOYEE-refused / typed-name / not-in-trash → table-driven
- `share-token.test.ts` vs `worker-share-token.test.ts` — same token lifecycle
- `kosztorys-lock.test.ts` overlaps `collections/sheets-investment-lock.db.test.ts` + `access/investment-lock.test.ts`
- equipment / fleet / worker duplicate-key specs near-copies
- weak `toBeDefined`/`toBeTruthy`: `template-structure:207`, `work-catalogue:104`, `sheets-investment-lock:264`, `create-investment-preset:122`
- `payout-confirmation.test.ts` mocks `getDb`, real accept/reject SQL untested here — check DB coverage
- `push/notify-pending-payouts.test.ts:14` mocks `PAYOUT_PUSH_PAUSED: false`; prod is `true` (bf9e22696) and nothing pins the pause
- leads: `fetch-lead-errors.test.ts:22-49` ≈ `fetch-lead.test.ts:44-52`; `store-lead.db.test.ts:4-5` orphan comment
- `it.each` candidates: `transfer-schema.test.ts:117-240` + `:493-582`; `cron/cleanup/route.test.ts:167-271`; `use-status-filter.test.ts:25-43`; `build-transfer-filters.test.ts:165-178`; `transfer-actions.test.ts:613-638, 861-899`
- lib/table: `column-toggle-order.test.ts` ≈ `column-order.test.ts`; `leaf-column-ids.test.ts:31` ≈ `column-order.test.ts:17-27`; `:47` weak `not.toEqual`
- `media/ingest-files.test.ts:45` = `ingest-picked-files.test.ts:66`; `equipment/notify` + `fleet/notify` repeat `email/recipients`; `fleet/oil` overlaps `should-notify` + `deadlines`; `fleet/rows` „costs" = `costs.test.ts`; `fleet/inspection-draft.test.ts:10` possible self-equality; `google/tab-rows.test.ts:176` overlaps `:224+`; `i18n/section-translations.test.ts:43` pins applied migration seed
- lib/kosztorys: `itemKey` test-only since fe2034ad0 → repoint `item-key.test.ts:31-80` at `sectionItemKey`/`keyItems`, drop export; `reconciliation.test.ts:111-115` = `:72-76`; `kosztorys-calc.test.ts:463-466`, `:394-428` test-side math; `breakdown-rows.test.ts:81-85` mirrors impl; `acceptance-protocol/settlement.test.ts:38-39` wiring; `summary-economics.test.ts:152-156` = `:130-134`; `subcontractor-due-by-plane.test.ts:98-102` never enables rabat; `row-height.test.ts:81-83` = `:58-60`; `kosztorys-v2-rows.test.ts:115-181` overlaps `row-view`/`kosztorys-sort-value`; `registry.test.ts:156-160`; `resolve-columns.test.ts:64-74`; `plane-price-keys.test.ts:63-67` loop w/o length check; `build-measured-qty-refresh.test.ts:92` misnamed; `client-view/columns.test.ts:12-14` length ≠ uniqueness; `settlement-columns.test.ts:66-69` = `:83-85`
- components/kosztorys (111 specs, 0 dead): `kosztorys-workers-menu.test.tsx:273` owner ⊂ manager `:241`, `role` + `CurrentUserProvider` vestigial since 0f664eece; `use-undo-redo.test.ts:159` "coalescing" = LIFO `:16`; `kosztorys-layer.test.ts:70,:80`; `editor-lock.test.ts:33` = `v2-columns-readonly.test.ts:22`; `stage-value-headers.test.tsx:43`; `use-inline-rename.test.tsx:78` doesn't-throw; `kosztorys-actions-menu.test.tsx:77`; `kosztorys-filters-menu.test.tsx:40` negatives on strings that no longer exist; `workshop-columns.test.ts:93/:107` dup, `:95` misplaced; `plane-price-columns.test.ts:83` title contradicts assertion; `kosztorys-money-axis.test.ts:68`; `kosztorys-editor-toolbar.test.tsx:20` invalid `moneyAxis: 'netto'` fixture; `remaining-overrun-tone.test.ts:75`
- other components: `form-clearing-contract.test.ts` tests the library; `data-table.test.tsx:57-87` passes with or without its fix; `add-sheet-dialog` / `sheet-setup-dialog` toast tests duplicate; `expense-draft-dialog-send.test.tsx:65-75` asserts the retired `scanMode` is absent; `accountCredentialsFormSchema` exported only for a spec; `cell-font-size.test.tsx:9` outside phone scope
- e2e: `investment-lock.spec.ts:93-95` `toHaveCount(0)` survives a label rename; `deposit-settlement-plane.spec.ts:66` passes on an empty table; worth a label-vs-src grep check so renames like EX-1017 can't silently rot specs
