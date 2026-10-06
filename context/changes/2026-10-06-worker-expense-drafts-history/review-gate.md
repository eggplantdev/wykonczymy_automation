# Review-gate ledger — worker-expense-drafts-history (EX-1005) · 2026-10-06

Scope: commits `5aa77fa7` `62d59df9` `a1037d0f` `3e4c4696` `3860a22f` `1eae65ca` `5fabf1be` on `staging`
(base `37cc8901`; the interleaved `723e4dd1` / `8dcf77c6` are another change's and are excluded).

Step 0.5 (browser verification) skipped — the Playwright browser is driven only on an explicit ask;
the manual pass lives in `context/foundation/manual-checks.md` § EX-1005.

## Findings

- [ ] 🟡 WARNING · proposed · code-review + impl-review F5 · `src/components/tables/expense-drafts.tsx:25` · „Wydatek” shows the FIRST transaction's amount when a draft was booked as several (`transferId: ids[0]`, `lib/actions/transfers.ts:159`) — a wrong figure, not just a partial link — owner's call: keep + record as a known limitation / show no amount (only a link) / persist every transfer id (migration)
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

- `pnpm exec tsc --noEmit -p .` — clean
- DOM/unit specs touched by the slice + gate fixes — 66 files, 468 tests pass
- `worker-expense-drafts.db.test.ts` vs 5435 — 17 pass; `lib/actions/worker-expense-drafts*.db.test.ts` — 38 pass
- after /simplify: `tsc` clean, eslint clean on touched files; `queue-filters`, `worker-expense-drafts-table`, `expense-drafts`, `pending-expense-drafts`, `leads-data-table`, `transfer-data-table-language` — 6 files / 27 tests pass
- after reuse-scan: `tsc` + eslint clean; `worker-expense-drafts.db.test.ts` + `worker-reports.test.ts` vs 5435 — 27 pass; `worker-investments-section.test.tsx` — 3 pass
- full suite — not run yet (awaiting your go)
