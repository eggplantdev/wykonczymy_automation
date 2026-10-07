# Review-gate ledger — worker-expense-drafts-history (EX-1005) · 2026-10-06

Scope: commits `5aa77fa7` `62d59df9` `a1037d0f` `3e4c4696` `3860a22f` `1eae65ca` `5fabf1be` on `staging`
(base `37cc8901`; the interleaved `723e4dd1` / `8dcf77c6` are another change's and are excluded).

Step 0.5 (browser verification) skipped — the Playwright browser is driven only on an explicit ask;
the manual pass lives in `context/foundation/manual-checks.md` § EX-1005.

## Findings

- [x] 🟡 WARNING · fixed · code-review + impl-review F5 · `src/components/tables/expense-drafts.tsx:24` · „Wydatek” showed the FIRST transaction's amount when a draft was booked as several — owner: persist every transfer id. New table `worker_expense_draft_transfers` (migration `20261006_2`, backfilled from `transfer_id`), `decideExpenseDraft` links all ids, column renamed „Transakcje”: sum of the live ones + count, struck-out sum only when all are cancelled, link `?id=a,b,c` (ID filter now takes a list) with cancelled shown; „od pracownika” badge on every one
      test: test-driven-debugging · integration — `actions/worker-expense-drafts.db.test.ts` accepts a 2-line draft and asserts both ids in the join table; unit/DOM: multi-id filter SQL, href, cell sum/count/link
      test: TDD · unit (DOM) — follows whichever option is chosen
- [x] 🟡 WARNING · fixed · impl-review F1 + code-review #2 · `src/lib/db/worker-expense-drafts.ts:53` · a cancelled transaction still reads as a live expense and its link opens an empty list — select `t.cancelled`, strike the amount, link with `showCancelled=1`
      test: TDD · unit (DOM) — `expense-drafts.test.tsx`: a cancelled one renders struck through and links with showCancelled; `worker-expense-drafts.db.test.ts` asserts `transferCancelled` from the row
- [x] 🔵 OBSERVATION · fixed · code-review #4 + impl-review F7 · `src/components/kosztorys/worker-report/report-grid.tsx:70` · `?view=summary` on a report with no rows lands on a blank page with no way back to „Zgłaszam pracę” — fall back to report mode when `!hasRows`
      test: test-driven-debugging · unit (DOM) — `worker-report-form.test.tsx`: no rows + `?view=summary` still offers the report mode
- [x] 🔵 OBSERVATION · fixed · code-review #5 · `src/components/worker-expenses/worker-expense-drafts-table.tsx:37` · a freshly sent draft lands on page 1 while the worker stays on page 3 — reset to page 1 when a newer draft arrives
      test: test-driven-debugging · unit (DOM) — rerender with a newer draft → page 1 (`worker-expense-drafts-table.test.tsx`)
- [x] fixed · code-review #10 · `src/components/worker-expenses/worker-expense-drafts-table.tsx:42` · `hasActions` counts every draft, so filtering to „Przyjęte” leaves an empty actions column on the 390px page — compute over `filtered`
      test: TDD · unit (DOM) — `worker-expense-drafts-table.test.tsx`: filter to „przyjęty” drops one column header
- [x] 🟡 WARNING · fixed · impl-review F2 · `src/components/worker-expenses/worker-expense-drafts-table.tsx:~102` · `storageKey="worker-expense-drafts"` from Phase 3 §2 missing — column visibility not remembered
- [x] 🟡 WARNING · fixed · impl-review F3 · `change.md` § „Decyzje po wdrożeniu” · investment-name link, removed `Description` on `/zgloszenia-wydatkow`, removed `max-w-4xl` not recorded
- [x] 🔵 OBSERVATION · fixed · impl-review F4 · `context/foundation/manual-checks.md:3817…4138` · EX-971 checks the plan said to re-point still describe the old list
- [x] 🔵 OBSERVATION · dropped · code-review #3 · `src/components/ui/pagination-footer.tsx:34` · page past the end after the last row on it is decided — the shared URL-pagination behaviour of every list (`/zgloszenia-prac`, Transakcje, leady), not this slice's; the pending block rarely spans a page
      test: no automated test — not fixed
- [x] 🔵 OBSERVATION · dismissed · code-review #6 · `src/lib/db/worker-expense-drafts.ts:215` · pending sorted newest first here vs oldest first on the dashboard — `QUEUE_ORDER` is the exact twin of `/zgloszenia-prac` (`lib/db/worker-reports.ts:300`), which the plan told this page to mirror
      test: no automated test — by design
- [x] 🔵 OBSERVATION · dismissed · impl-review F6 / code-review (fork) · `src/lib/db/worker-expense-drafts.ts:162` · badge vs history on a pending draft with a trashed investment — `pendingDraftsProbe` blocks trashing such an investment; the residual send-vs-trash race is already accepted (`investment-trash.ts:33`)
      test: no automated test — unreachable
- [x] 🔵 OBSERVATION · dropped · impl-review F8 · `src/__tests__/lib/db/worker-expense-drafts.db.test.ts:112` · criterion-4.3 grep hits the test helper `rejectedDraftOf` — no production reference; renaming a helper for a grep is churn
- [x] dismissed · code-review #9 · `src/components/users/worker-investments-section.tsx:50` · `next/link` vs `<a>` for the share URL — `OptionalLink` is the shared primitive; the (share) group's own root layout makes it a full navigation either way
- [x] fixed · code-review #7 · `src/lib/queries/worker-expense-drafts.ts:63` · paging meta copied from `worker-reports-list.ts:43` — one `paginationMetaFromCount` in `lib/utils/pagination.ts`
- [x] fixed · code-review #8 + module-cohesion · `src/lib/queries/worker-expense-drafts.ts:18` · `managementDb` imported from `worker-reports-list` — move to `lib/queries/management-db.ts`
- [x] fixed · feature-first + structure-scatter + module-cohesion · `src/lib/constants/worker-expense-drafts.ts:10` · sortable-column whitelist outside the `lib/<domain>/sortable-columns.ts` home the three siblings share — move to `lib/worker-expenses/sortable-columns.ts`
- [x] fixed · feature-first + structure-scatter · `src/components/ui/pagination-footer.tsx`, `url-pagination.tsx` · pagination family split between `ui/` root and `ui/pagination/` — move both in
- [x] fixed · module-cohesion · `src/components/worker-expenses/draft-status-badge.tsx:9` · `DRAFT_STATUS_LABEL_KEYS` exported from a badge file for two tables — move beside `EXPENSE_DRAFT_STATUSES`
- [x] fixed · feature-first · `src/components/users/worker-investments-section.tsx:53` · `?view=summary` assembled by hand, `'summary'` spelled in two files — one URL helper in `worker-links.ts`
- [x] fixed · module-cohesion · `src/lib/db/worker-expense-drafts.ts:103` · `isWorkerLiveRegister` (pre-existing) queries only `cash_registers` — move to `lib/db/cash-register-gate.ts`
- [x] skipped · module-cohesion · `src/lib/db/worker-expense-drafts.ts` · 540 LOC, history listing could split out — the twin `lib/db/worker-reports.ts` has the same shape; a split of one without the other is scatter, and both together is its own refactor
- [x] dropped · structure-scatter · `src/lib/queries/expense-draft-{filters,sort}.ts` · prefix differs from `worker-expense-drafts.ts` — rename churn for alphabetical order
- [x] fixed · comment-noise · `tables/expense-drafts.tsx:18,20`, `lib/db/worker-expense-drafts.ts:236`, `filters/queue-filters.tsx:24`, `worker-expense-drafts-table.tsx:74`, `worker-expense-drafts.db.test.ts:314` · six restating comments — delete
- [x] fixed · comment-noise · `ui/pagination/page-nav.tsx:18`, `worker-view/worker-links.ts:29` · two comments carrying a rejected-alternative / caller list — trim
- [x] clean · tailwind-v4-audit · — · no findings
- [x] fixed · simplify (efficiency) · `src/lib/db/worker-expense-drafts.ts:59` · every row shipped its AI read to the browser, though only a pending draft's acceptance prefill reads it — the worker page sends his whole history — `CASE WHEN status = 'pending'` in `DRAFT_SELECT`
- [x] dropped · simplify (efficiency) · `src/lib/db/worker-expense-drafts.ts:246` · filter-option queries rerun per page click — already parallel, one pooled query; no latency to win
- [x] skipped · simplify (altitude) · `src/lib/utils/investment-transfers-href.ts:27` · `showCancelled` is passed per caller; the deeper fix is `buildTransferFilters` letting a numeric `?id=` reach a cancelled row — changes every transfers list (a typed ID finds a cancelled row with „Pokaż anulowane” off), outside this slice's owner ruling; side wart: editing the ID box after the link keeps `showCancelled=1`
- [x] dismissed · simplify (altitude) · `src/app/(frontend)/pracownicy/[id]/page.tsx:46` · „10 written twice” — that 10 is the transactions table's default, a separate owner decision from the drafts table's; one constant would couple them
- [x] fixed · simplify (reuse) · `src/components/worker-expenses/worker-expense-drafts-table.tsx:26` · hand-rolled `matchesFilter` re-implements `useClientMultiFilter` (`hooks/use-client-multi-filter.ts`) — chained twice, as in `cash-registers-table.tsx`
- [x] fixed · simplify (reuse) · `src/lib/queries/{expense-draft,worker-report}-filters.ts` · twin parsers differing only in the status guard — one `parseQueueFilters(sp, isStatus)` (`lib/queries/queue-filters.ts`) + `QueueFiltersT<S>` (`types/filters.ts`); the two specs merged into `queue-filters.test.ts`
- [x] fixed · simplify (reuse) · `src/components/tables/expense-drafts.tsx:36` · hand-written `<Link className="hover:underline">` branch — `OptionalLink`
- [x] fixed · simplify (simplification) · `src/components/ui/pagination/{url-pagination,page-nav,pagination-footer}.tsx` · dead `onNavigate` / `className` / `jumpSize` props (no caller passes them) and a footer guard + wrapper `PageNav` already enforces — removed
- [x] dropped · simplify (simplification) · `src/components/tables/expense-drafts.tsx:52` · derive `enableSorting` by mapping columns like `tables/transfers.tsx:270` — accessor columns carry `accessorKey`, not `id`, so the map needs a key fallback + casts; `sortable(id)` already reads the whitelist, the win is two `false`s
- [x] dropped · simplify (simplification) · `src/lib/db/worker-expense-drafts.ts` `ExpenseDraftRowT` · group `transfer*` into one `transfer` object — reshapes the row mapper, 5 DOM fixtures and the DB spec for a naming nicety
- [x] dropped · simplify (reuse) · `src/lib/queries/expense-draft-sort.ts` · sort-gate `valid`/`parse` shared with three siblings — the params ≈ the code, and the four differ in their default
- [x] dismissed · simplify (efficiency) · `src/app/(frontend)/zgloszenia-wydatkow/page.tsx:19` · sort parsed server-side and again in the table — the shared pattern of every URL table; keeps junk out of the cache key
- [x] dropped · simplify (reuse) · `src/components/worker-expenses/{worker-expense-drafts-table,expense-drafts-data-table}.tsx` · status options + „Zobacz” built twice — ~4 lines each
- [x] skipped · simplify (reuse) · `src/components/worker-expenses/pending-expense-drafts.tsx` · dashboard's pending grid could render via `useExpenseDraftColumns` — a design change to the dashboard card, not a dedup; owner's call if wanted
- [x] fixed · reuse-scan · `src/lib/db/worker-expense-drafts.ts:190` · `draftHistoryWhere` copied `decidableReportsWhere` line for line — one `queueFiltersWhere(alias, base, filters)` (`lib/db/queue-filters-where.ts`), proven on 5435 by both DB specs
- [x] fixed · reuse-scan · `src/lib/queries/worker-expense-drafts.ts:45` · `ExpenseDraftsPageT` = `WorkerReportsPageT` but for the row — `QueuePageT<RowT>` in `types/filters.ts`
- [x] fixed · reuse-scan · `src/components/users/worker-investments-section.tsx:52` · the share URL built twice per row (name link + `ReportLinkCell`) — computed once, passed down
- [x] dropped · reuse-scan · `src/lib/queries/worker-expense-drafts.ts:52` · `fetchExpenseDraftsPage` ≈ `fetchWorkerReportsPage` — a shared body takes both list functions as params, as long as the code
- [x] dropped · reuse-scan · `src/lib/db/worker-expense-drafts.ts:201` · ORDER BY builder ≈ reports' — drafts need `NULLS LAST` on `decidedAt`; same family as the dropped sort gate
- [x] dropped · reuse-scan · `src/lib/db/worker-expense-drafts.ts:242` · filter-option queries ≈ reports' — joins and base differ; only a one-line `toItem` is identical
- [x] dropped · reuse-scan · `src/components/worker-expenses/expense-drafts-data-table.tsx:74` · URL sort wiring repeated across four tables — a `useUrlSort` hook's params ≈ the code
- [x] dismissed · reuse-scan · `worker-expense-drafts-table.tsx:83`, `tables/expense-drafts.tsx:25`, `queue-filters.tsx:14`, `zgloszenia-wydatkow/{page,loading}.tsx`, `use-expense-draft-acceptance.tsx:30` · near-matches (`paginationMetaFromCount` doesn't clamp; `formatPLNOrDash` saves only the dash; `toOptions` returns `{id,name}`; `TitledPageLoading` per route is the EX-877 rule; `downloadPages` moved unchanged)
- [x] filed · e2e · — · browser path (accept → „Wydatek” link, cancelled strike-through, „Przywróć” on the new page, menu counter) — folded into the existing EX-971 E2E as steps 5–6, its step 5 was stale (rejected rows left Transakcje) · filed EX-997

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 5 applied, 0 proposed, 9 dropped/dismissed/skipped; each finding folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- typecheck (`tsc --noEmit`) — pass
- touched unit + DOM specs (tables, worker-expenses, expense-form, lib/worker-expenses, transfer-filters, investment-transfers-href, transfer-actions) — 24 files / 220 tests pass
- DB specs vs 5435 (`db/worker-expense-drafts`, `actions/worker-expense-drafts`, `-worker`, `read-expense-draft-receipts`) — 46 pass, after `db:migrate:test` applied `20261006_3`
- full suite — not run (awaiting the user's go)

- `pnpm exec tsc --noEmit -p .` — clean
- DOM/unit specs touched by the slice + gate fixes — 66 files, 468 tests pass
- `worker-expense-drafts.db.test.ts` vs 5435 — 17 pass; `lib/actions/worker-expense-drafts*.db.test.ts` — 38 pass
- after /simplify: `tsc` clean, eslint clean on touched files; `queue-filters`, `worker-expense-drafts-table`, `expense-drafts`, `pending-expense-drafts`, `leads-data-table`, `transfer-data-table-language` — 6 files / 27 tests pass
- after reuse-scan: `tsc` + eslint clean; `worker-expense-drafts.db.test.ts` + `worker-reports.test.ts` vs 5435 — 27 pass; `worker-investments-section.test.tsx` — 3 pass
- full suite — not run yet (awaiting your go)

---

# Round 2 — per-paragon rows · commit 6be6a64a (diff 90182380...6be6a64a) · 2026-10-06

Scope: only the per-paragon spike (one row per paragon, skipped paragony kept, dashboard queue on `DataTable`, default status „czeka"). Round 1 above is closed and not re-reviewed. Fan-out: code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only). Skipped: 10x-impl-review (`plan.md` predates the spike — it has no plan to diff against), Step 0.5 browser pass (by request).

## Findings

- [x] 🟡 WARNING · filed · code-review · `src/migrations/20261006_2_add_worker_expense_draft_transfers.ts:5` · the old deploy keeps writing `worker_expense_drafts.transfer_id` between the prod migrate and the push, and the migration that copies those rows and drops the column does not exist yet — filed EX-1007 (deploy-time follow-up, destructive order: push first)
      test: no automated test · — one-off migration; the issue records the before/after row-count check
- [x] 🟡 WARNING · dismissed · code-review · `src/lib/actions/transfers.ts:92` · the server takes `receiptMediaIds` / `skippedReceipts` unchecked — `ownPages` (INTERSECT with the draft's own pages, `db/worker-expense-drafts.ts:315`) drops any page of another draft, the action is management-only, and both lists are now derived from one prefill map at submit
      test: no automated test · — the server path is unchanged; the client derivation has its guard (next line)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/forms/expense-form/expense-form.tsx:245` · skipped paragony were an append-only `useState` beside the line items, so a removed-then-re-added row could go out as both booked and skipped — now derived from the line items at submit
      test: TDD · unit (dom) — `expense-form-prefill.test.tsx` „paragon usunięty z przyjęcia idzie jako pominięty…" asserts the action's `receiptMediaIds` / `skippedReceipts`
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/components/tables/expense-drafts.test.tsx` · the multi-line acceptance test asserted the old first-transfer link — deleted: after `splitByReceipt` no row carries more than one transakcja, so the case it pinned is unreachable (see simplify A2)
      test: no automated test · — the test was the finding
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/worker-expenses/split-by-receipt.ts:11` · a transfer with empty `mediaIds` shows every page of the zgłoszenie — the honest fallback for a pre-EX-1005 acceptance and a hand-added row
      test: TDD · unit — `split-by-receipt.test.ts` pins the legacy fallback
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/worker-expense-drafts.ts:316` · INTERSECT does not keep page order — the pages cell orders by the draft's own media order, not this array
      test: no automated test · — no observable effect
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/migrations/20261006_3_add_worker_expense_draft_receipts.ts:24` · destructive `down` — down is local-only and drops only what its own `up` created
      test: no automated test · — local-only path
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/db/worker-expense-drafts.ts:264` · the manager list paginates by zgłoszenia while the table shows one row per paragon, so a page can hold more than `limit` rows — owner (2026-10-06): fine, the list already defaults to 100 per page
      test: no automated test · — accepted as is
- [x] 🔵 OBSERVATION · filed · code-review · `src/components/worker-expenses/expense-drafts-data-table.tsx:48` · a skipped paragon reads „odrzucony" under an accepted zgłoszenie and has no „Przywróć"; the server's status filter reads the zgłoszenie's status, so „odrzucone" never lists a skipped paragon and „zaakceptowane" lists rows badged „odrzucony" — owner (2026-10-06): must be restorable and the filter must catch it; the restore semantics need research, filed EX-1009
      test: no automated test · — product decision pending
- [x] dismissed · code-review · `src/components/worker-expenses/worker-expense-drafts-table.tsx:56` · `splitByReceipt` runs every render — React Compiler memoises it, and the list is one worker's history
- [x] dropped · code-review · `src/lib/db/worker-expense-drafts.ts:48` · make `mediaIds` / `skippedReceipts` required on the row type — fixture churn across specs for no runtime gain
- [x] dismissed · code-review · `src/components/transfers/transfer-filters.tsx:292` · `toIdList` keeps stray commas — moot: the id-list filter was reverted (simplify A2)
- [x] fixed · comment-noise-audit · `src/components/tables/expense-drafts.tsx:26` · stale TransfersCell comment (described the first-transfer link) — replaced with the one-transakcja invariant `TransferCell` rests on
- [x] dismissed · comment-noise-audit · `src/lib/queries/transfer-filters.ts:148` · moot — the file is back to its 90182380 state (simplify A2)
- [x] fixed · comment-noise-audit · `src/lib/db/worker-expense-drafts.ts:46` · deleted — restated the array type
- [x] fixed · comment-noise-audit · `src/__tests__/lib/actions/worker-expense-drafts.db.test.ts:139` · deleted — vanished state („not just the first"), the test name says the rest
- [x] dismissed · comment-noise-audit · `src/components/tables/expense-drafts.tsx:20`, `src/lib/db/worker-expense-drafts.ts:48`, `split-by-receipt.ts` header, migrations' „Hand-written" lines, `db/worker-expense-drafts.db.test.ts:168`, `investment-transfers-href.test.ts:32` · each carries a why the code does not say
- [x] fixed · user request · `src/components/worker-expenses/open-expense-draft-button.tsx` · the action column jumped when the loader appeared — the spinner now replaces the icon; the button is deduped into `OpenExpenseDraftButton` for the dashboard queue and `/zgloszenia-wydatkow`
- [x] fixed · user request · `open-expense-draft-button.tsx` · „Zobacz" → „Zweryfikuj"
- [x] fixed · user request · `src/components/tables/expense-drafts.tsx:63` · the dashboard queue's first column gets the header „Podgląd" (`expenseDrafts.preview`, pl/uk/ru)
- [x] fixed · user request · `src/components/tables/expense-drafts.tsx:24` · owner (2026-10-06): management on a worker's page gets the transaction link — `canOpenTransfers` from `pracownicy/[id]` (`isManager`), the worker himself still gets plain text
      test: TDD · unit (dom) — `worker-expense-drafts-table.test.tsx` „links a manager on the worker page…"
- [x] dropped · module-cohesion-audit · `src/lib/db/worker-expense-drafts.ts:298` · module grows (fragments + mappers + CTE builder + probes, ~590 lines) — still one domain; a split now is churn without a second consumer
- [x] dismissed · structure-scatter-audit · `src/lib/worker-expenses/split-by-receipt.ts:1` · type-only cycle with `lib/db/worker-expense-drafts` — benign, no runtime import
- [x] dismissed · tailwind-v4-audit · — · no findings
- [x] dismissed · feature-first-structure · — · no findings (`lib/worker-expenses/` is an established home)
- [x] fixed · simplify · `src/lib/db/worker-expense-drafts.ts:315` · the `linked` / `skipped` CTEs were spliced in only when non-empty — now unconditional; `jsonb_to_recordset('[]')` yields no rows (DB specs green)
- [x] fixed · simplify · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:185` · both callers rebuilt the same `OpenExpenseDraftButton` from `open` + `loadingId` — the hook returns `openButton(draft)` instead
- [x] fixed · simplify · `src/components/forms/expense-form/expense-form.tsx:238` · the receipts / skipped derivation sat inline in the shared form — moved to React-free `lib/worker-expenses/receipt-decision.ts` (Set lookup instead of `some` per entry)
- [x] fixed · simplify · `src/lib/actions/transfers.ts:92` · `opts` fields were each optional though the one caller always sends all three — required now; the guard is `if (opts)`
- [x] fixed · simplify · `src/components/tables/expense-drafts.tsx:27` · (A2) the multi-transakcja cell and the `?id=a,b,c` filter served a row `splitByReceipt` never produces — reverted `transfer-filters.ts`, `transfer-filters.tsx`, `investment-transfers-href.ts` + their specs to 90182380; the cell is single-transakcja `TransferCell`
- [x] skipped · simplify · `src/components/worker-expenses/expense-drafts-data-table.tsx` · (A1) one paragon table with the split done server-side would also fix pagination and the status filter — a review-worthy refactor tied to the two pending owner decisions above
- [x] dropped · simplify · `src/components/tables/expense-drafts.tsx:21` · (A3) column groups in place of the `isPendingQueue` flag — churn with two consumers
- [x] dropped · simplify · `open-expense-draft-button.tsx` · reuse against `RestoreExpenseDraftButton` / a shared loading button — different shapes (server action vs local download), no common contract
- [x] dismissed · simplify · — · efficiency: no findings
- [x] dropped · reuse-scan · `src/components/worker-expenses/open-expense-draft-button.tsx:17` · the `isX ? <Loader2/> : <Icon/>` swap repeats in `ui/upload-button.tsx:34`, `print-transfers-button.tsx:87`, `invoice-download-button.tsx:50` — a primitive would take the icon and the flag as params, i.e. the same one expression; no drift risk to remove
- [x] dropped · reuse-scan · `expense-drafts-data-table.tsx:58` / `worker-expense-drafts-table.tsx:101` · the status-options map is written twice — both copies derive from the shared `EXPENSE_DRAFT_STATUSES` + `DRAFT_STATUS_LABEL_KEYS`, so a wrapper adds a file without removing a second source of truth
- [x] dismissed · reuse-scan · `TransferCell`, `receipt-decision.ts`, `split-by-receipt.ts` `pagesOf` · no existing primitive (near-miss `lib/utils/group-in-order.ts:16` `regroupByKeys` flattens and drops leftovers)

## Simplify pass

Ran /simplify — 5 applied, 0 proposed, 4 dismissed/dropped/skipped; each folded into ## Findings (tagged simplify).

## Tests & suite
