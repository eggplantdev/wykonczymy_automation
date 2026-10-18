# Phase 3 — consolidation (2026-10-18)

Fewer lines, same safety net: `it.each` over structurally identical cases, adoption of existing
helpers (`createKosztorysTree`, `createRegisterOwner`, `baseItem`), shared factories for multi-line
boilerplate, merging root specs into their mirror, plus the guards phase 2 left open.

Rule per change: every assertion keeps its discriminating power — a consolidated table row fails on
the same mutation the old case failed on. One-line boilerplate (`vi.mock('server-only')`, `ENV_READY`)
is not worth the churn and stays.

The transfer specs waited for the `transfer-actions-db-spec` change to land; their section below also
carries the phase-2 drops the new DB spec made redundant.

## Findings

### root, leads, hooks, app (−582 net)

- [x] · fixed · it.each · `transfer-schema.test.ts` missing-field (15), amount edge (3), form-schema missing (11) → tables · −166
- [x] · fixed · it.each · `app/(payload)/api/cron/cleanup/route.test.ts` one `RESULTS`/`STEPS` table drives the breakdown and „still reports every other step when %s throws" per step, exact `toEqual` · −153
- [x] · fixed · it.each · `build-transfer-filters.test.ts` search-param filters (17) and amount search (13) · −40
- [x] · fixed · it.each · `use-status-filter.test.ts` `filterByStatuses` (7) and `selectionFrom`; „hides rejected" now asserts the exact set · −14
- [x] · fixed · it.each · `validate-hook.test.ts` 13 missing-required cases, omit-by-key destructure · −48
- [x] · fixed · it.each · `toggle-actions.test.ts` active true/false pairs · −24
- [x] · fixed · it.each · `optimistic-form-store.test.ts` three „releases the key" cases (success, failure, rejection) · −23
- [x] · fixed · mirror merge · `transfer-table.test.ts` → `lib/queries/transfer-mapping.test.ts` `createdByName` table through `buildTransferLookups`; root file removed · −62
- [x] · fixed · gap · `utils.test.ts` formatPLN exact strings with ` ` (pl-PL here: plain NBSP, no 4-digit grouping → `12345.67` added); −0 / −7e-12 / −0.004 assert `0,00 zł` · −24
- [x] · fixed · gap · `lib/leads/fetch-lead-errors.test.ts` → `fetch-lead.test.ts` — `mockFetch({}, false)` rejects `/status 500/`, isolating `!res.ok`; old case overlapped the error-body one; file removed · −27
- [x] · fixed · trap · `lib/leads/fetch-landing-asset.test.ts:5` env assignment moved below the imports, the order it really runs in (`LANDING_BLOB_HOST` read at call time); `vi.hoisted` can't see the fixture import · −1
- [x] · skipped · mirror merge · `assert-complete-page.test.ts` ↔ `lib/queries/assert-complete-page.db.test.ts` · the mirror is DB-gated; the unit cases would stop running without a DB
- [x] · skipped · mirror merge · `kosztorys-chart-slices.test.ts` · no mirror exists; a pure move
- [x] · dismissed · mirror merge · `leads/fetch-lead`, `leads/reconcile-leads` · files don't exist
- [x] · dropped · it.each · `transfer-constants`, `access-control`, `default-cash-register`, `derive-financials-bucketing`, `hooks/transfers/validate-*`, `leads/notify`, `lib/leads/reconcile-sweep`, `app/**` routes · already tables, or per-case setup a table would hide

### lib (non-kosztorys, non-leads), collections, stores (−265 net)

- [x] · fixed · gap · `lib/queries/preview-kosztorys-read.test.ts`, `worker-kosztorys-read.test.ts` assert `requireAuth` gets `MANAGEMENT_ROLES` — mutation-checked (dropping the argument fails it) · +8
- [x] · fixed · table · new `helpers/trash-contract.ts` `describeTrashContract`, adopted by `equipment-trash.db` and `vehicle-trash.db`; equipment gains the idempotent-trash case · −53
- [x] · skipped · table · cash-register, investment, lead, template, worker trash specs · setup differs (children, guards, typed-name variants)
- [x] · dismissed · merge · `share-token` vs `worker-share-token` · different action, collection and resolver; only the duplicate `find` helpers inside `share-token` merged · −7
- [x] · dismissed · merge · equipment / fleet / worker duplicate-key specs · normalisation and messages differ, no shared helper
- [x] · dismissed · overlap · `kosztorys-lock` (actions) / `sheets-investment-lock.db` (collection access) / `access/investment-lock` (gate) · three layers, no overlapping case
- [x] · fixed · helper adoption · `createRegisterOwner` in `register-balance-net-expense`, `cash-registers-delete-guard`, `cash-registers/purge-trash.db` · −29
- [x] · fixed · helper adoption · `createKosztorysTree` in `kosztorys-restore`, `kosztorys-bulk-discount-snapshot`, `kosztorys-compare-with-sheet`, `kosztorys-presets`, `work-catalogue-save` · ≈−110
- [x] · dropped · helper adoption · `kosztorys-stages`, `kosztorys-delete-guard` · local helpers come out the same size
- [x] · fixed · it.each · `lib/media/file-archive.test.ts` `sanitizeForFilename` / `buildArchiveName` / `buildArchiveMessage` · −62
- [x] · fixed · it.each · `lib/utils/append-short-id.test.ts`, `lib/transfers/clear-fields-for-type.test.ts` · −15
- [x] · dropped · it.each · `token-action` refusals (−2 after prettier), `user-sessions.db`, `text-wrap`, `fleet/flags`, `catalogue-usage.db` · a table saves a few lines and loses per-case rationale

### components, src/hooks, e2e (−24 net)

- [x] · fixed · facade · `components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` test-only `buildV2Columns` removed; 16 grid specs call `buildV2Grid(o).columns` (37 calls) · −4
- [x] · fixed · placement · `components/kosztorys/editor/hooks/kosztorys-column-widths.test.ts` → `hooks/create-json-map-store.test.ts` (owner of `dropKeys`); 4 cases → 3, no-mutation check folded · −40
- [x] · fixed · weak · `forms/expense-form/expense-form-merge.test.tsx` `toBeGreaterThan(0)` on `/zdjecie-10[12]/` → `getAllByText(/zdjecie-101/)` length 2 — the preview never shows 102, so the old regex was half-vacuous · 0
- [x] · fixed · helper · `forms/settle-payouts-form/settle-payouts-form.test.tsx` local `bookBonus(user)` for the two plain confirm clicks · −4
- [x] · dismissed · dedup · `add-sheet-dialog` / `sheet-setup-dialog` toasts · two components, own wiring; sheet sync is being retired
- [x] · skipped · it.each · `expense-draft-duplicate-mark`, `draft-prefill`, `line-draft`, `new-item-dialog` and other large DOM specs · each case asserts different things (research §8)
- [x] · skipped · vacuous · `e2e/investment-lock.spec.ts:93-95` positive control · not runnable here and „Pobierz z arkusza Google" may need a linked sheet — not obviously right; „Zapisz jako nowy szablon" already proves the menu opened

### lib/kosztorys (−453 net)

- [x] · fixed · weak · `sheet-import/build-sheet-comparison.test.ts` `executedNetFromSheet > 0` → `toBeCloseTo(2287.5, 6)`, hand-derived Σetapów × cena − rabat · +1
- [x] · fixed · helper adoption · `baseItem` in 13 files (`kosztorys-sort-value`, `kosztorys-calc`, `margin-forecast`, `build-import-plan`, `subcontractor-price-guard`, `subcontractor-price-edit`, `kosztorys-empty-sections`, `build-catalogue-comparison`, `row-conditions/fixtures`, `client-document-subtotals`, `item-key`, `build-measured-qty-refresh`, `build-sheet-comparison`) · ≈−180
- [x] · fixed · it.each · `kosztorys-v2-rows.test.ts` diffRow no-ops, `hasStagesOverPlanned` (double-assert case split into two rows), `applyRestoreItem` · −18
- [x] · fixed · it.each · `row-conditions/registry.test.ts` 8 `matches(id, row) → bool` boundary tests (28 asserts) → one table · −30
- [x] · fixed · it.each · `kosztorys-calc.test.ts` `rowPlannedDiscountForView`, zero-qty `netForQty`; dropped the 216 assert duplicating the `rowPlannedNetForView` percent case · −30
- [x] · fixed · helper · `work-catalogue/build-catalogue-comparison.test.ts` local `compareOne` / `figureOf` / `NO_RATES`; no-diff cases → `it.each` · −63
- [x] · dismissed · helper adoption · `createKosztorysTree` · no hand-rolled chains in the partition
- [x] · dismissed · helper adoption · measure-discrepancy, price-divergence, serialize-restore-roundtrip, cell-edit, item-to-catalogue · not a `baseItem` shape
- [x] · dropped · it.each · `kosztorys-calc` globalDiscountAmount / isGlobalDiscountActive · ≤4 LOC, cases carry rationale
- [x] · fixed · stale expectation · `print/worker` rate column under a section total expects the „Razem — Łazienka" label (`labelSpan` spans every column left of the first total since 53c3a5b22; `''` never passed) · ±0
- [x] · fixed · assertion merge · `print/worker` header order → one `slice(0, 3).toEqual` · −2
- [x] · fixed · helper · `print/offer` local `headersOf` / `bandTotalSpans`, one shared `updatedRows` fixture · −16
- [x] · fixed · helper + it.each · `subcontractor-due-by-plane` `dueFor()` for 11 build-then-compute pairs, hoisted `sumOf`, pomiar-per-view pair → table · −42
- [x] · fixed · assertion merge + it.each · `sheet-import/resolve-columns` single-assert layout cases folded into the wide-layout case; Pomiar absent/ambiguous and the 3 „fails …" cases → tables; module-level `expectRefused` · −44
- [x] · fixed · it.each · `sheet-import/resolve-columns-mapping` 3 „ignores a pointing …" cases → one table · −14
- [x] · fixed · redundant · `display-order-plan` dropped „covers every row exactly once" — the exact `toEqual` on `after` / `before` already fails on any mutation it would catch · −7
- [x] · fixed · helper · `display-order` (DB) `newSection` / `addItems` replace 6 add-section-assert-unwrap blocks · −24
- [x] · fixed · dedup · `serialize-restore-roundtrip` + `serialize-apply-preset` near-copies of a canonicalizer → `helpers/canonical-snapshot.ts`; roundtrip adopts `firstUserId` + local `restore()`; preset zero checks → `toMatchObject(ZEROED_JOB_FIGURES)` · −82 (−129 / +47 helper)
- [x] · dismissed · it.each · `columns/column-totals` · every case asserts a different figure
- [x] · dropped · it.each · `templates/serialize-template` fixture loop · same length after prettier

### transfer specs (−523 net)

Mutation-checked in `lib/actions/transfers.ts`: CANCELLATION-type refusal, PAYOUT worker drop on edit, bulk
form-level worker, refusal permission verb, depth 0, legacy wpłata `netAmount ?? null`, CANCELLATION
`createdBy` — each broken guard fails a merged case.

- [x] · dropped · R-db · `transfer-actions` valid INVESTOR_DEPOSIT / PAYOUT → success · −17 / `transfers.db.test.ts:203` ledger steps 1, 7
- [x] · dropped · R-db · `transfer-actions` LABOR_COST skips `validateSourceRegister` + `queriedTables` · −19 / `transfers.db.test.ts:203` step 4
- [x] · dropped · R-db · `transfer-actions` rollback mid-batch · −12 / `transfers.db.test.ts:380`
- [x] · dropped · R-db · `bulk-transaction.test.ts` deleted; rollback → `transfers.db.test.ts:380`, its two worker-per-row cases moved to `transfer-actions` · −131
- [x] · dropped · R-db · `transfer-actions` cancel success · −27 / `transfers.db.test.ts:448`
- [x] · dropped · R-db · `transfer-actions` cancel / update on a cancelled row · −20 / `transfers.db.test.ts:497` (shared `fetchAndAuthorize`)
- [x] · dropped · R-db · `transfer-actions` cancel audit-row create failure · −10 / `transfers.db.test.ts:437`
- [x] · dropped · R-db · `transfer-actions` BONUS MANAGER refusal, single path · `transfers.db.test.ts:333`; bulk half stays
- [x] · fixed · trim · `transfer-actions` CANCELLATION audit row asserts only `createdBy` = canceller (now ≠ creator) and no `paymentMethod` · −12
- [x] · fixed · merge · `transfer-actions` update „passes all edited fields" folded into update success · −20
- [x] · fixed · describe.each · `transfer-actions` cancel + update permission matrices → one table over both actions (4 allow, 3 refuse with no-write assert, depth 0, update failure) · −150
- [x] · fixed · it.each · `transfer-actions` create validation refusals, invoice pass-through, bulk validation refusals · −35
- [x] · fixed · merge · `transfer-actions` bulk per-item data + 40-item batch → one 3-line case checking `req` / `skipSheetSync` per line · −20
- [x] · fixed · it.each + helper · `transfer-actions` legacy wpłata fill-ins (`editLegacyDeposit`), update worker cases, 7 invoice-append cases · −100
- [x] · fixed · stub adoption · `transfers.db` hand-rolled auth mock → `stubs/require-auth` · −6
- [x] · fixed · helper · `transfers.db` per-type column case → `row(type, carried)` · −41
- [x] · dismissed · `transfer-actions` „manager can transfer from any register", „does not sync the sheet directly" · kept by `phase-1-dead-tests.md:31-32`, no DB case covers them
- [x] · dismissed · `transfer-actions` invoice actions, `deleteOrphanedMediaAction`, permission rows · sole guards of `setUploadField` / `appendUploadIds` / `canMutateTransfer` / `canBookTransferType`

### Cross-cutting boilerplate (≈−550 net)

- [x] · fixed · boilerplate · 50 specs: the `requireAuth` mock scaffold + hoisted `authState` → `vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))` + `import { authState }` (new `stubs/require-auth.ts`, same pattern as `stubs/cache-revalidate`) · ≈−300
- [x] · fixed · boilerplate · 29 specs: the user lookup → `await firstUserId(payload)` (new `helpers/first-user-id.ts`, throws on an empty DB); `kosztorys-presets` lost its local copy · ≈−100
- [x] · fixed · boilerplate · `calculate-balance`, `calculate-margin`, `financial-golden-master-db`, `lib/db/sum-transfers`, `lib/queries/investment-financial-fields`, `lib/queries/shape-investments`: zero-financials literals → `ZERO_FINANCIALS` (`src/types/investment-financials.ts`) or `{ ...ZERO_FINANCIALS, <non-zero> }`; the golden master's own copy deleted · −152
- [x] · skipped · boilerplate · lookalikes that differ: `mockRequireAuth(...args)` forwarders (toggle-actions, dashboard, push), the `authState.result` pair (preview-/worker-kosztorys-read), ADMIN „t@t.pl" users, „Kierownik" users, role-gated variants, EMPLOYEE `session.userId`, lookups filtering on role or two users
- [x] · skipped · boilerplate · `lib/actions/transfers.db.test.ts` zero-financials literal · another change owns the file
