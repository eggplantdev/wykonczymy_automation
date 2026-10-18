# Phase 2 — redundant tests (2026-10-18)

"Redundant" = the bug it catches is already caught elsewhere, or it pins nothing the product owns:
R1 exact / near duplicate · R2 subsumed by a stronger neighbour · R3 mirrors the implementation
(expected value computed the way the code computes it) · R4 tests a library / framework contract ·
R5 weak assertion beside a stronger one on the same output. Consolidation (`it.each`, helpers) is
phase 3.

Gate per finding: "which production bug becomes undetectable if this goes?" → "none, because
<surviving test>". Different layers guarding different risks (SQL vs mapping) both stay.

## Findings

### actions / collections / stores

- [x] · fixed · R2 · `lib/actions/kosztorys-delete-guard.test.ts` (a), (c), (e) · `removeItemAction` / `removeSectionAction` never branch on progress — (c2) is (c) plus the snapshot, (d) deletes a section through the harder FK path
- [x] · fixed · R2 · `lib/actions/kosztorys-stages.test.ts` „all cleared to 0", „no progress rows" · `removeStageAction` has no branch; the recorded-progress case runs the same delete + cascade
- [x] · fixed · R2 · `lib/actions/work-catalogue-save.test.ts` „zapis zapamiętuje…" · the rename case asserts the same unconditional link write
- [x] · fixed · R2 · `lib/actions/worker-duplicate-email.db.test.ts` trashed exact-case · the case/space variant hits the same `emailClash` message after normalisation; the unique index makes the count check unfailable
- [x] · fixed · R2 · `lib/actions/sheets-sync.test.ts` no re-append / drift heal / colliding id · „reports update and remove counts" pins `toAppend [9]` with 7 on the sheet; the transfers-tab case pins `updated: 1` at A2; the colliding-id case could not fail (the mock returns no orphans whatever the scope) — the where-clause test is the guard
- [x] · fixed · R2 · `lib/actions/work-catalogue.test.ts` „deletes a row" · `work-catalogue-delete-templates.db.test.ts` deletes through the same action and reads the row back
- [x] · fixed · R5 · `template-structure.test.ts` / `work-catalogue.test.ts` `toBeDefined` · the next line fails on `undefined` anyway
- [x] · fixed · R2 · `collections/cash-registers-delete-guard.test.ts` cancelled-only · `cash-register-trash.db.test.ts` „a delete strips it off that row" runs the same hook through the action
- [x] · fixed · R2 · `collections/cash-registers-update-guard.test.ts` restore · `cash-register-trash.db.test.ts` sends the identical `trashedAt: null` update
- [x] · fixed · R2 · `collections/investments-delete-guard.test.ts` positive control · the cancelled-only describe deletes through the same hook; teardown no longer assumes a test deleted the row
- [x] · fixed · R2 · `stores/pending-store.test.ts` „raises a label" · every later case starts a key and reads `firstPendingLabel`
- [x] · dismissed · `collections/users-delete-guard.test.ts:150` positive control · it is also the teardown of four reference tables; removing it strands rows the `afterAll` doesn't clean

### lib/kosztorys

- [x] · fixed · R3 · `kosztorys-calc.test.ts` „brutto = netto × (1 + vatRate)" describe + „do zapłaty = suma − rabat" · expected values multiplied in the test; replaced by one literal case per price view
- [x] · fixed · R1/R2 · `summary-economics.test.ts` 8 cases (inverse pairs, materiały netto = brutto, VAT-on-prace axis gap, przelew overshoot ×3, rabat relocation) · each restates a figure the `computeAmountDue` cases already pin as a literal
- [x] · fixed · R1 · `reconciliation.test.ts` „vatRate 0" · no branch on 0; the rate cases cover the multiplication
- [x] · fixed · R2 · `subcontractor-due-by-plane.test.ts` „any single stage null", „unchanged by per-item rabat" · the „nieprzypisany etap" case; the fixture already carries an 8 zł rabat
- [x] · fixed · R2 · `off-plane-deposits.test.ts` 3 per-mode cases · the mode × plane loop and the literal {2, 150} cases
- [x] · fixed · R2 · `settlement-mode.test.ts` Mieszane ≠ netto · `off-plane-deposits` mode × plane loop
- [x] · fixed · R2 · `summary-reading.test.ts` „robocizna + rabat addable back" · the summary literal cases
- [x] · fixed · R1 · `deposit-planes.test.ts` „counts ONLY przelewy on the brutto plane" · `sumDeposits` is `depositPairFromPlaneSums(bucketDepositsByPlane())`, both pinned
- [x] · fixed · R1 · `kosztorys-settlement.test.ts` global-discount off / positive amount · `reconciliation.test.ts` „nothing booked" (8 zł per-item sum) and „global amount discount" (14 zł)
- [x] · fixed · R1 · `stage-split.test.ts` „Σ shares equal to the pool for an uneven split" · same split asserted at the 3437,40 pool
- [x] · fixed · R5 · `subcontractor-price-guard.test.ts` `MAX_CLIENT_SHARE` pins · 65 / 55,25 on a 100 zł price pin the same ratios
- [x] · fixed · R1 · `row-height.test.ts` „client preview… sizes to the content" · „falls back to the content height"
- [x] · fixed · R1 · `kosztorys-v2-rows.test.ts` sortRows asc/desc, pl collation, nulls last; `rowTotalQtyDone` sum · `row-view-sort-scope`, `row-view-sort-within-sections` (both directions, nulls, pl), `kosztorys-sort-value` plannedQty; `subcontractor-due-by-plane` client = 5
- [x] · fixed · R2 · `settlement-columns.test.ts` „never hides Pozostało", two worker-set cases · the exact-set case at the top of the describe
- [x] · fixed · R1 · `row-conditions/registry.test.ts` „bez przedmiaru i bez wykonanej pracy" · its one new line (work → not empty) folded into „client-empty"
- [x] · fixed · R2 · `row-conditions/queries.test.ts` „leaves the other plane alone" · the exact-set case before it
- [x] · fixed · R1 · `sheet-import/resolve-columns.test.ts` crew-renamed etapy, wartość block · the Przedpole / Białostocka layout cases pin the same `stages`
- [x] · fixed · R2 · `sheet-import/formula-health.test.ts` „Pomiar copied without listing" · the mixed case pins the count and the sample list
- [x] · fixed · R2 · `work-catalogue/build-catalogue-comparison.test.ts` „stawka auto", „podpowiada najbliższą nazwę" · the grosz-tolerance case runs on auto rates; the top-3 case pins the closest first
- [x] · fixed · R1 · `review-status.test.ts` 12 vs 2 line · 12 vs 10 two lines up
- [x] · fixed · R2 · `print/offer.test.ts` „bez wpisów drukuje samą ofertę", „ukrycie kolumny…" · the next case proves the empty-etap wiring; „ukryta Wartość netto" proves the hidden-column wiring
- [x] · fixed · R2 · `worker-view/settings.test.ts` „no key in any group is client-priced" · `WORKER_VIEW_KEYS` is the groups flattened; the visible-columns case checks `CLIENT_PRICED` against it
- [x] · fixed · R2 · `client-view/settings.test.ts` disclosure-ceiling case, 4 `toContain` · the subcontractor-key case runs the same filter; the exact visible list implies them
- [x] · fixed · R2 · `client-view/settings-new-column.test.ts` whole file · default / round-trip cases in `settings.test.ts`; `plannedDiscountAmount` and its rationale folded into the stored-map case
- [x] · fixed · R2 · `worker-report/report-preview.test.ts` all-pending, all-rejected · `outcomeOf` is per line; the mixed case pins all three outcomes
- [x] · fixed · R1 · `append-preset-sections.test.ts` (c) empty target · (b) also appends into a fresh investment and pins `displayOrder` [0, 1]
- [x] · fixed · R1 · `cell-edit.test.ts` „nie stawia sufitu rabatowi kwotowemu" · the 250 zł amount commit pinned exactly above it
- [x] · fixed · R2 · `kosztorys-axis-checkboxes.test.ts` round-trip · each transition is its own case
- [x] · fixed · R3 · `kosztorys-empty-sections.test.ts` „zwiń sekcje" describe · tested a test-local `deselect`; the condition's section set is pinned in the same file
- [x] · fixed · vacuous · `display-order-plan.test.ts` „gapped section in stored order" · `planKosztorysRenumber` never reads `displayOrder`
- [x] · fixed · weak · `client-view/columns.test.ts` „exactly once" · a length check doesn't prove coverage; now Set-equal too
- [x] · fixed · weak · `plane-price-keys.test.ts` per-plane loop · passed on an empty list; length pinned
- [x] · fixed · weak · `sheet-import/parse-labor-tab.test.ts` section colours · now pinned to `sectionColorForIndex` by position
- [x] · fixed · title · `build-measured-qty-refresh.test.ts` „clears" → „replaces"
- [x] · skipped · weak · `build-sheet-comparison.test.ts` `executedNetFromSheet > 0` · the literal needs a run to read; phase 3
- [x] · dismissed · `print/offer.test.ts` `editorTotals` oracle · the print receives the totals as input, so it is a pass-through check, not R3
- [x] · dismissed · `default-coeffs.test.ts` · the only guard of the sheet's `=R−R*0,15` relation
- [x] · dismissed · `row-conditions/registry.test.ts` „kwota stała as hand-typed" · the exclusivity loop checks one hit, not which
- [x] · dismissed · `item-ref.db.test.ts` restore · the only guard that restore keeps the numbers
- [x] · dismissed · `work-catalogue/catalogue-key.test.ts` TYPO_FIXES each, `catalogue-conditions.test.ts:80` · the cleaner/key agreement and the table-cell agreement have no twin
- [x] · dismissed · `sheet-import/item-key.ts` `itemKey` · test-only, but it names `keyItems`' key format; repointing re-implements it in the spec
- [x] · dismissed · `row-conditions/queries.test.ts` union, `ctx.test.ts` · exact Set; the `ctx` case pins that the map moves the count

### components (non-kosztorys) + e2e

- [x] · fixed · R2 · `e2e/smoke.spec.ts` whole file · `e2e/auth.spec.ts:5` logs in through the same form; no script references it (stale mention dropped from `playwright.config.ts`)
- [x] · fixed · R2 · `components/ui/upload-button.test.tsx` whole file · one consumer; `investment-assets-field.test.tsx:28-33` asserts the label and disabled state through it
- [x] · fixed · R2 · `forms/worker-form/worker-schema.test.ts` `storedLanguageSchema` describe · `workerSchema.language` is that schema; the `workerSchema` cases pin pl→null, uk/ru, de refused
- [x] · fixed · R1 · `nav/unread-badge.test.tsx` „Zgłoszenia wydatków" sibling · same `isActiveLink` prefix branch as „Zgłoszenia prac"
- [x] · fixed · R2 · `forms/expense-form/row-file-positions.test.ts` round-trip + EX-448 describe · each direction keeps its exact case
- [x] · fixed · R2 · `forms/deposit-form/deposit-payment-method.test.tsx` „zapisuje przelew" · „wysyła brutto…" asserts a superset payload incl. `paymentMethod: 'TRANSFER'`
- [x] · fixed · R2 · `forms/work-catalogue-item/work-catalogue-item-form.test.tsx` „still refuses a blank kwota" · the „auto" case hits the same error and counts one action call
- [x] · fixed · R1 · `tables/data-table/data-table.test.tsx` row-identity `firstRowTexts` line · the first case asserts it after the same toggle
- [x] · fixed · R5 · `worker-expenses/expense-draft-dialog-send.test.tsx` `not.toHaveProperty('scanMode')` · the reader never reads `scan_mode` (phase 1)
- [x] · fixed · R2 · `e2e/notification-recipients.spec.ts` „same address typed twice" · dedup lives in `recipientEmailsSchema`, DB-covered at `lib/actions/notification-recipients.test.ts:81`
- [x] · fixed · title · `forms/expense-form/expense-form-merge.test.tsx:103` · claimed a shared-photo check it never made; the photo case is its neighbour
- [x] · skipped · weak · `forms/expense-form/expense-form-merge.test.tsx:130` `length > 0` · the exact count needs a run; phase 3
- [x] · skipped · vacuous · `e2e/investment-lock.spec.ts:93-95` negatives survive a label rename · fix is a positive control in the unlocked state, needs an e2e run
- [x] · dismissed · `equipment/cell-font-size.test.tsx` · only guard of 782fe255d
- [x] · dismissed · `tables/data-table/data-table.test.tsx:57-87` · still guards header/body agreement
- [x] · dismissed · `e2e/deposit-settlement-plane.spec.ts:122-139` · instrument validated by the one-row read before it

### lib (media, fleet, google, i18n, env, expense-duplicates, transfers) + cron route

- [x] · fixed · R2 · `lib/media/ingest-picked-files.test.ts` non-blocked failure, pick order · the wrapper only calls `ingestFiles`; `ingest-files.test.ts:26,45` and the compaction case
- [x] · fixed · R2 · `lib/fleet/oil.test.ts` „measures from the change itself" · the 100k base case
- [x] · fixed · R2 · `lib/fleet/rows.test.ts` 5 pass-through cases · `costs.test.ts`, `flags.test.ts`, `deadlines.test.ts`; the window / mark / oil cases still prove the pass-through
- [x] · fixed · vacuous · `lib/google/tab-rows.test.ts` `settledAmount` `toBeUndefined` · the field exists nowhere in src
- [x] · fixed · R5 · `lib/google/tab-rows.test.ts` 3× `toBeDefined` · the next `row!.` line fails anyway
- [x] · fixed · R3 · `lib/google/tab-rows.test.ts` „sheet totals == filtered view" describe · its oracle was a filter written in the test; „maps each of the six types" is the guard
- [x] · fixed · R2 · `lib/google/tab-rows.test.ts` non-settled / absent flag / bridge (a) · „maps an expense", bridges (b) and (c), „settled INVESTMENT_EXPENSE: kwota 0"
- [x] · fixed · R2 · `lib/google/sheets.test.ts` „overwrites an existing id in place" · „updates present, appends missing, removes orphans" pins 102→A3, `updated: 1`
- [x] · fixed · R4 · `lib/i18n/section-translations.test.ts` seed contents · pins an applied migration's data; „reaches every seeded entry" stays
- [x] · fixed · R1/R2 · `lib/env/schema.test.ts` store-id pin, absence, preview · the literal-token refusals fail on a stale id; the rest repeat the preview-token case and the VAPID `it.each` row
- [x] · fixed · R1 · `lib/expense-duplicates/find-duplicates.test.ts` 2025 twins · `match.test.ts:138`; the read-row cases prove the wiring
- [x] · fixed · R2 · `lib/media/delete-unreferenced-media.test.ts` single delete / single spare · the batch case deletes [1, 3] and spares 2
- [x] · fixed · R2 · `lib/media/upload-ids.test.ts` single upload · the sparse and attachment-order cases
- [x] · fixed · R2 · `lib/media/file-archive.test.ts` illegal chars, usedNames, plain count · „all dangerous characters", the `_2` counter case, „counts pages, not rows"
- [x] · fixed · R5 · `lib/transfers/clear-fields-for-type.test.ts` 2× `not.toHaveProperty` · the exact `toEqual` for INVESTMENT_EXPENSE
- [x] · fixed · R2 · `app/(payload)/api/cron/cleanup/route.test.ts` wrong secret, unset secret · `lib/cron/verify-cron-request.test.ts:28,36`; the no-header case proves the 401 wiring
- [x] · fixed · test-only export · `lib/i18n/translation-fill.ts` `escapeCell` · no caller outside the spec; moved into it
- [x] · fixed · vacuous · `app/(frontend)/api/extract-receipt/route.test.ts:39` `arrayContaining([])` · now `expect.any(Array)`; length 2 checked next

### components/kosztorys

Paths under `components/kosztorys/editor/` unless noted.

- [x] · fixed · R1 · `toolbar/menus/kosztorys-workers-menu.test.tsx` owner view-settings case + vestigial `role` / `CurrentUserProvider` · no kosztorys component reads `useCurrentUser`; the manager case asserts the same dialog
- [x] · fixed · vestigial · `toolbar/menus/kosztorys-actions-menu.test.tsx`, `actions/tree-rewrite-menu-items.test.tsx` `CurrentUserProvider` · nothing under test reads it
- [x] · fixed · fixture · `toolbar/kosztorys-editor-toolbar.test.tsx` `moneyAxis: 'netto'` → `'net'`, `layer: 'all'` → `'both'`; stale session comment and provider gone · outside the `MoneyAxisT` / `LayerT` unions
- [x] · fixed · R1 · `hooks/use-undo-redo.test.ts` „coalescing" · LIFO `:16` + stack-ends `:31`
- [x] · fixed · R1 · `grid/kosztorys-layer.test.ts` untagged column, collapsing etapy · `price` and `stageValueNet_*` membership asserted by the „praca" / „postęp" cases
- [x] · fixed · R1 · `grid/editor-lock.test.ts` „disables every cell" · `v2-columns-readonly.test.ts:22-26`
- [x] · fixed · R1 · `grid/stage-value-headers.test.tsx` rename case · headers derive from the label alone; „names every one of an etap's columns"
- [x] · fixed · R1/R2 · `grid/workshop-columns.test.ts` misplaced price-source case, duplicate row-actions case · `plane-price-columns` „source column in every view"; „keeps the row-actions column whatever the picker says"
- [x] · fixed · R5 + vacuous · `grid/preview-columns.test.ts` „accepts the correct pair", „does not throw on the subcontractor plane"; rate-exclusion now runs with `crewAxis: 'both'` · every `previewIds()` call throws on a wrong pair; the exclusion only passed because the default axis already hid the columns
- [x] · fixed · title · `grid/plane-price-columns.test.ts:83` · contradicted its assertion
- [x] · fixed · R1 · `grid/v2-columns-order.test.ts` „ignored by the client preview" · `preview-columns` „not reordered by the per-browser column order"
- [x] · fixed · R2 · `grid/cells/subcontractor-columns-delete.test.ts` Delete on „Mnożnik" / „Cena j.m." · `del` short-circuits on `writable`; the non-author-cell case covers both
- [x] · fixed · R1 · `toolbar/menus/problems-menu-model.test.ts` 2 cases · zero-count drop, engaged tick, „(0)" cases
- [x] · fixed · R2 · `toolbar/menus/filters-menu-model.test.ts` „no filter without a category" · exact `toEqual` over every id in registry order
- [x] · fixed · R2 · `components/kosztorys/summary/model/settlement-groups.test.ts` nothing absorbed, no materiały step · exact label list in „reads top-down"
- [x] · fixed · R2 · `dialogs/catalogue/catalogue-missing-list.test.tsx` „wysyła opis i j.m. kandydata" · same click, superset payload in the translations case
- [x] · fixed · vacuous · `toolbar/menus/kosztorys-filters-menu.test.tsx:44-45` negatives on strings gone since 5ee08f0ec · the `'Filtry'` trigger-name assertion stays
- [x] · fixed · vacuous · `grid/stage-column-filter.test.ts:102` revealed `'priceMode'`, not a column id · now a real plane rate; positive control `plane-price-columns.test.ts:97`
- [x] · fixed · vestigial · `grid/remaining-overrun-tone.test.ts:76` identical tuple element in both rows · flat id list
- [x] · fixed · R1 · `grid/kosztorys-money-axis.test.ts:72` NEUTRAL_IDS loop in the „none" case · the fail-open case loops over `'none'`
- [x] · skipped · placement · `hooks/kosztorys-column-widths.test.ts` belongs in `hooks/create-json-map-store.test.ts` · a move, phase 3
- [x] · dismissed · `hooks/use-inline-rename.test.tsx:71` no-`stopEditing` · live path at `stage-header.tsx:65`, only guard

### lib/db, lib/queries, lib/utils, lib/table, lib/cache

- [x] · fixed · R1/R2 · `lib/db/sum-transfers.test.ts` 11 cases (balance from rows, incoming-only, type+settled distribution, category costs, settled out of materials, settledCategoryCosts ×2, material split, non-material types, second sentinel) · `derive-financials-bucketing.test.ts` (28 type×settled pairs, passthrough, mixed reconcile, `it.each(TRANSFER_TYPES)`), `settled-vs-unsettled-expense.test.ts`, and the same file's balance / sentinel cases
- [x] · fixed · R1 · `lib/queries/preview-kosztorys-read.test.ts`, `worker-kosztorys-read.test.ts` role-below case · the mock ignores roles — it was the unauthenticated case twice
- [x] · skipped · gap · same two specs · nothing pins `requireAuth(MANAGEMENT_ROLES)` (`preview-kosztorys.ts:130`, `worker-kosztorys.ts:133`); needs a new guard
- [x] · fixed · R2 · `lib/queries/shape-investments.test.ts` „folds material with no category" · „keeps material with no category inside wydatki inwestycyjne"
- [x] · fixed · R2 · `lib/queries/kosztorys-client-view.test.ts` „finds the row without a session" · the own-row case runs session-less too
- [x] · fixed · R2 · `lib/queries/transfer-sort-spans-dataset.db.test.ts` global max on page one · the top-20 `toEqual`
- [x] · fixed · R5 · `preview-kosztorys-history`, `investment-financial-fields`, `kosztorys-client-totals`, `kosztorys-subcontractor-due`, `snapshots` (7), `kosztorys-tree.db`, `get-payout-transactions` (retitled), `cash-register-trash.db:72`, `worker-reports:191` · an exact `toEqual` / dereference beside each
- [x] · fixed · R2 · `lib/db/investment-trash.db.test.ts` etap-measured counts as used · the purge `toEqual([priceOnly, empty])` runs the same SQL
- [x] · fixed · R2 · `lib/db/where-to-sql.test.ts` or-branch parentheses · „keeps a range intact inside an or branch"
- [x] · fixed · R1/R2 · `lib/table/column-toggle-order.test.ts` whole file · every case has a twin in `column-order.test.ts`
- [x] · fixed · R1/R3 · `lib/table/leaf-column-ids.test.ts` „base ranks under a stored rank" describe · `column-order.test.ts:17,55`; the stale-base `not.toEqual` guarded no caller
- [x] · fixed · R2 · `lib/utils/fold-text.test.ts` 2 cases · „folds every Polish diacritic", „folds ł/Ł", `foldFilter('Źródło', 'zrodlo')`
- [x] · fixed · R2 · `lib/cache/revalidate.test.ts` „every tag on both branches" · each branch test compares its full tag list

### root, leads, hooks, app

- [x] · fixed · R1 · `transactions-report-filters.test.ts` 'no filters excludes cancelled', 'invalid paymentMethod', 'multiple categories via comma' · build-transfer-filters 'no params excludes cancelled' / 'paymentMethod param with invalid value' / 'otherCategory param supports multi-select'
- [x] · fixed · R1 · `build-transfer-filters.test.ts` 'worker param absent', 'plain integer passes through unchanged' · exact toEqual in 'no params excludes cancelled'; same prefix branch as '18' / '18000'
- [x] · fixed · R1 · `transfer-loss.test.ts`, `transfer-rabat.test.ts` (whole files) · transfer-constants truth-table matrix + exact TRANSACTION_TRANSFER_TYPES / TRANSFER_TYPES lists + labels :342-343
- [x] · fixed · R1 · `transfer-constants.test.ts` describe 'needsSourceRegister — CANCELLATION' · truth-table matrix
- [x] · fixed · R2 · `transfer-constants.test.ts` 'every array entry is a valid TransferTypeT' · exact lists + typing
- [x] · fixed · R1 · `transfer-constants.test.ts` 'INVESTMENT_EXPENSE_NET is the counterexample', 'settleable still implies an expenses-tab row' (+ the empty describe) · matrix; transfer-spec-table 'a settleable type always owns an expenses-tab row'
- [x] · fixed · R1 · `transfer-constants.test.ts` 'TRANSACTION_TRANSFER_TYPES excludes deposits and REGISTER_TRANSFER' → retitled '…excludes REGISTER_TRANSFER', deposits loop removed · transfer-spec-table 'TRANSACTION_TRANSFER_TYPES contains no deposit type'
- [x] · fixed · R2 · `transfer-spec-table.test.ts` describe 'sheet-sync inputs are eager at module load' · the exact lists in transfer-constants fail on an empty array
- [x] · fixed · R2 · `transfer-actions.test.ts` 'valid INVESTMENT_EXPENSE transfer → success', 'zero amount', 'negative amount' · 'creates with correct data shape' + default success test; transfer-schema 'amount = 0 / -1 → fails' ('missing amount' still proves the wiring)
- [x] · fixed · R1 · `bulk-transaction.test.ts` 'commits when all items succeed', 'all creates share the same transaction ID' · transfer-actions 'large batch (40 items)'
- [x] · fixed · R1 · `transfer-schema.test.ts` 'BONUS needs no kasa', 'non-deposit types do NOT require vatPlane', describe 'schema parity — valid payloads' · the valid-payloads loops
- [x] · fixed · R2 · `receipt-filename.test.ts` 'is deterministic across calls' · exact-string test
- [x] · fixed · R3 · `roles.test.ts` 'matches MANAGEMENT_ROLES constant', 'matches ADMIN_OR_OWNER_ROLES constant' (+ now-unused imports) · these only mirrored the implementation
- [x] · fixed · R2 · `small-utils.test.ts` refineAmount valid / empty / zero / negative, refineDate non-empty · transfer-schema amount/date cases (transferFormSchema uses both refiners)
- [x] · fixed · R5 · `kosztorys-chart-slices.test.ts` `new Set(ids).size` line · the exact toEqual that follows
- [x] · fixed · R5 · `assert-complete-page.test.ts` bare toThrow 'throws when the result is truncated' · the regex toThrow test
- [x] · fixed · R2 · `calculate-margin.test.ts` 'subtracts both rabat and loss' · the rabat and loss terms are each tested alone (linear formula)
- [x] · fixed · R2 · `calculate-balance.test.ts` 'cancels an expense covered by a loss' · linear formula, terms tested alone
- [x] · fixed · R2 · `datasheet-grid-row-height-cache.test.ts` not.toThrow 'measures a row once the cache is empty' · 'rebuilds the offsets from zero' (toEqual)
- [x] · fixed · R2 · `receipt-extraction-schema.test.ts` 'allows netAmount to be null' · the amount-null test also parses `netAmount: null`
- [x] · fixed · R2 · `use-status-filter.test.ts` 'all selected → every row' · plain membership cases
- [x] · fixed · R2 · `access-control.test.ts` 'refuses an EMPLOYEE on another row' · canUpdateUser ignores the id
- [x] · fixed · R2 · `default-cash-register.test.ts` 'no default register', 'worker not found' · getUserDefaultCashRegisterId undefined cases + the trashed case
- [x] · fixed · R2 · `toggle-actions.test.ts` 'calls payload.update with collection="users"…' / '…="cash-registers"…', cash-register 'auth failure', 'payload.update throws' · exact toHaveBeenCalledWith; shared toggleActive covered through the user tests
- [x] · fixed · R1 · `utils.test.ts` parsePagination defaults / valid / page=0 / negative page, getRelationName 'extra fields' · lib/utils/pagination.test.ts
- [x] · fixed · R2 · `optimistic-form-store.test.ts` 'openDialog sets openFormId' · 'opening a different dialog replaces the previous one'
- [x] · fixed · vacuous · `optimistic-form-store.test.ts` 'a failed submit reopens without resetting keepOpen' · only called setState; now drives a real failing `submitOptimistically`
- [x] · fixed · R1 · `validate-hook.test.ts` 'INVESTMENT_EXPENSE with expenseCategory → passes', 'different registers → passes' · VALID_DATA loop :58-64
- [x] · fixed · R1 · `validate-hook.test.ts` 'LOSS without investment → throws' · hooks/transfers/validate-error-surfacing.test.ts:28-33
- [x] · fixed · R1 · `validate-hook.test.ts` 'OTHER → investment set to null', 'REGISTER_TRANSFER → investment set to null' · investment-write-guard.test.ts:37-40 (CLEARED loop); the explanatory OTHER comment moved there
- [x] · fixed · R1 · `hooks/transfers/investment-write-guard.test.ts` 'a create keeps the investment' · 'an update keeps the investment' (the clear is operation-agnostic) + validate-hook 'INVESTMENT_EXPENSE → investment preserved'
- [x] · fixed · R1 · `derive-financials-bucketing.test.ts:95-97` length 28 · transfer-constants:220 exact TRANSFER_TYPES list
- [x] · fixed · R1 · `derive-financials-bucketing.test.ts:123-129` materialsGrossBase / totalSettled untouched · the matrix cell INVESTMENT_EXPENSE_NET·settled=false asserts 0 for both, whatever the amount
- [x] · fixed · R1 · `lib/leads/fetch-lead-errors.test.ts` 'error object despite a 200', 'returns the raw body on success' · fetch-lead.test.ts:49-52 (stronger regex), :44-47; orphan comment reattached to the surviving test
- [x] · fixed · R1 · `lib/leads/reconcile-sweep.test.ts` 'does not flag a form whose page came back short' · :44-51 (short page, saturatedForms `[]`)
- [x] · fixed · R1 · `lib/leads/store-lead.test.ts` 'creates when no sibling exists', 'returns the existing sibling' · store-lead.db.test.ts:42-62 (DB)
- [x] · fixed · R1 · `leads/capture-lead.test.ts` 'sends both channels when no options are given' · :28-33 happy path
- [x] · fixed · R5 · `leads/normalize-lead.test.ts` 'does not promote a CUSTOM field via the key heuristic' + `:32 not.toContain('Bemowo')` · exact toBe name/phone at :23-28 and :36-41
- [x] · fixed · R1 · `leads/lead-schema.test.ts` 'parses a lead without the optional form_id' · reconcile-sweep :44 (real leadSchema, rawLead has no form_id)
- [x] · fixed · R2 · `leads/webhook-route.test.ts` 'returns non-200 when a lead fails to store' · 'still isolates a failing lead…' (also 500)
- [x] · fixed · R1 · `leads/wpforms.test.ts` 'tags the lead as the website_form source' · wpforms-route.test.ts:74-80 (real mapper)
- [x] · fixed · R1 · `lib/leads/landing.test.ts` 'accepts the shared fixture', 'rejects … without a uuid submissionId', source/externalId lines · webhooks/landing route.test :79-84, :86-93 (real schema and mapper)
- [x] · fixed · R2 · `lib/leads/release-landing-assets.test.ts:45-47` wrong-secret / submission-scope asserts · :44 + verify-signature.test.ts:47-57
- [x] · fixed · R5 · `leads/notify.test.ts:43` `to not.toContain(lead.email)` · exact toEqual :42
- [x] · fixed · vacuous · `leads/notify.test.ts:45` `subject not.toContain('TEST')` removed · the subject is a constant with no TEST branch
- [x] · fixed · R1 · `lib/leads/fetch-landing-asset.test.ts:49` link-local row · `http://` is refused by the protocol check, the same branch as the 'plain http' row
- [x] · fixed · R1 · `hooks/transfers/invoice-on-cancellation.db.test.ts` 'still refuses a CANCELLATION create with no reference' · validate-hook 'still refuses a cancellation with no original' + validate-error-surfacing :35
- [x] · fixed · R1 · `hooks/transfers/vat-plane-write-guard.db.test.ts` 'strips a plane…', 'keeps the plane…' + companyFunding fixture · validate-hook vatPlane :359-377; DB keep stays at the 'legacy wpłata' test
- [x] · fixed · R1 · `hooks/transfers/guard-delete.test.ts` 'string id', 'no investment' · lib/db/investment-gate.test.ts:103-113
- [x] · fixed · wrong title · `hooks/transfers/guard-delete.test.ts` '…public 403…' now also asserts `status: 403`
- [x] · fixed · R1 · `hooks/transfers/delete-invoice-media.test.ts` 'keeps a page another expense still references' · lib/media/delete-unreferenced-media.test.ts:65-70 (transactions `[2]` spared)
- [x] · fixed · R1 · `hooks/transfers/validate-lock.test.ts` 'lets an invoice-only write through', 'lets an invoice removal through' · invoice-on-locked-investment.db.test.ts:104, :115 (DB)
- [x] · fixed · R1 · `hooks/investments/guard-status-unlock.test.ts` 'lets %s reopen' (OWNER, ADMIN), 're-save with the same status' · lib/actions/investment-unlock.test.ts:81, :89, :108 (DB)
- [x] · fixed · R1 · `hooks/investments/stamp-completed-at.test.ts` 'a refused unlock throws before the date is cleared' (+ the unused import and role param) · its `:82` could never fail (the hook returns a copy and never mutates `data`); the refusal is in guard-status-unlock :23-30
- [x] · fixed · R1 · `app/(payload)/api/cron/translate-catalogue/route.test.ts` 'reads as a failed run when every batch failed' · :43-51 (`failed=1` → `ok:false`, `ok = failed === 0`)
- [x] · fixed · wrong title · `app/(frontend)/api/media-register/route.test.ts` 'sniffs only the first KB…' → 'still sniffs the type when the CDN ignores the range…', now asserts `mimeType: 'application/pdf'`
- [x] · fixed · vacuous · `app/(frontend)/api/extract-receipt/route.test.ts:39` `arrayContaining([])` → `expect.any(Array)`
- [x] · fixed · R3 · `resolve-id.test.ts` CACHE_TAGS 'has expected keys' · typecheck at every `CACHE_TAGS.x` consumer
- [x] · fixed · redundant mock · `vi.mock('server-only')` removed (vitest.config.ts:14 aliases it) in auth-actions, bulk-transaction, toggle-actions, transfer-table, transfer-actions, action-utils, the read-worker-report / media-register / media-upload / extract-receipt route specs, hooks/transfers/{invoice-on-cancellation, vat-plane-write-guard, invoice-on-locked-investment, payout-status-default, investment-write-guard}.db, hooks/equipment/target-invariant.db, and lib/leads/{purge-trash.db, erase-lead} (the unused `vi` import was removed in both)
- [x] · fixed · hardcode · `lib/leads/purge-trash.db.test.ts` `30` → `ENTITY_TRASH_RETENTION_DAYS`
- [x] · fixed · orphan comment · `lib/leads/store-lead.db.test.ts:4-5` revalidateTag comment removed
- [x] · dismissed · `hooks/sync-sheet.test.ts:78` "not one of the six" · correct as written: it refers to the six synced types listed at :70
- [x] · dismissed · `lib/leads/fetch-landing-asset.test.ts` SSRF host guard "never isolated" · the 'a different host' row (`https://evil…`) clears the protocol check and reaches the host check alone
- [x] · skipped · gap · `lib/push/notify-pending-payouts.test.ts:14` mocks `PAYOUT_PUSH_PAUSED: false`; prod is `true` and nothing pins the pause · needs a new guard
- [x] · skipped · gap · `utils.test.ts:118-143` formatPLN weak assertions · needs a new guard
- [x] · skipped · gap · `lib/leads/fetch-lead-errors.test.ts` `!res.ok` branch never isolated (the 500 fixture also carries an error body) · needs a new guard
- [x] · dropped · gap · `hooks/sync-sheet.test.ts` previousDoc branch untested · sheet sync is deprecated and about to be retired — no new tests for it
- [x] · skipped · trap · `lib/leads/fetch-landing-asset.test.ts:5` sets `process.env` below a hoisted import; it works only because serverEnv reads lazily · fixing it needs vi.hoisted without the fixture import

## Verified not redundant

Per-section dismissals above carry their reason. Kept after a candidate was raised against them:

- `leads/notifications.db.test.ts:69-77` no cursor → epoch · the shell-badge spec compares against the same SQL, so it can't catch a missing `COALESCE`
- `leads/wpforms.test.ts` „emailless input" · only guard of `normalizeLead`'s no-questions path without an email
- `app/(frontend)/api/webhooks/landing/route.test.ts:67-71` missing signature → 403 · catches a route that skips the check when the header is absent
- `hooks/transfers/guard-delete.test.ts` „active investment" · the hook's only negative control
- `hooks/transfers/validate-lock.test.ts` „smuggles another field alongside the invoice" · only guard of `isInvoiceOnlyPatch` against a mixed patch
- `derive-financials-bucketing.test.ts` netto `materialsNetBilled` and „no netAmount bills 0" · the matrix uses total = netTotal, so it can't tell which one is read
- `utils.test.ts` parsePagination NaN / page-size 25, `small-utils.test.ts` refineAmount decimal / refineDate message · not covered by `pagination.test.ts` / `transfer-schema`
- `fleet/oil` „a change entered without a reading" · only `isOilChangeOverdue(null)` case
- `google/tab-rows` settled expense → plain category type · only check of that path
- `i18n/section-translations` „reaches every seeded entry"; `media/ingest-files.test.ts` · owns what the picked-files wrapper relies on
- `media/delete-unreferenced-media` vehicle-inspection, equipment-event, „every registered relation", one-page batch cases
- cron cleanup route „no Authorization header" · proves the route wiring
- `transfers/clear-fields-for-type` CORRECTION lines
- `problems-menu-model` „warns for work still to enter too" · only measure-diverged case
- `plane-price-columns` „assembles the source column in every view" · client-side price-source guard
- `preview-columns` „cannot reach the subcontractor rate columns" · only preview-vs-rate leak guard (now non-vacuous)
- `kosztorys-filters-menu` tick count vs „Wyczyść" · different branches
- `kosztorys-money-axis` „oba" opt-out vs „oba naprawdę pokazuje obie strony" · deliberate pair
- `remaining-overrun-tone` przedmiar vs Aktualizacja `it.each` · assert different rows

## Carried to phase 3

- `it.each` / helper consolidation (candidates in `phase-1-dead-tests.md` → Phase-2 notes)
- ~118 `vi.mock('server-only')` copies outside the root partition (`vitest.config.ts` aliases it)
- `kosztorys-column-widths` spec move; `build-sheet-comparison` literal that needs a run
- skipped gaps above: `PAYOUT_PUSH_PAUSED`, formatPLN, `MANAGEMENT_ROLES`, fetch-lead `!res.ok`, fetch-landing-asset env hoisting
