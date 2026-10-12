---
date: 2026-10-11T19:56:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 5a6ddef7622f08e81b420790b4cf984ecd467271
branch: invoice-download-date-range
repository: wykonczymy
topic: 'Per-investment transactions — kosztorys tab vs a separate page (started as a „Transakcje” tab)'
tags: [research, codebase, kosztorys, summary-panel, investment-page, transfers-table, EX-1041]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Added follow-up research on the filter seam'
---

# Research: „Transakcje” tab in the kosztorys Podsumowanie — and is the single investment page still needed?

**Date**: 2026-10-11T19:56:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 5a6ddef76
**Branch**: invoice-download-date-range
**Repository**: wykonczymy
**Linear**: EX-1041

## Research Question

Add a „Transakcje” tab to the kosztorys summary panel (Podsumowanie · Materiały · Robocizna ·
Podwykonawcy · Marża · Inwestycja). Some transactions are shown there already. Almost everything has
moved into the kosztorys, so is the single investment page (`/inwestycje/[id]`) still justified?

The five sub-questions from EX-1041: (1) what the page shows that the summary doesn't, (2) overlap
with transactions already in the summary tabs, (3) where transactions of an investment without a
kosztorys live, (4) entry points to `/inwestycje/[id]`, (5) can the transfers table be reused in a tab.

## Summary

- **The page is already mostly a transactions page.** Strip what the editor's „Inwestycja” tab and
  the summary panel duplicate (info list, notes, gallery, „Edytuj inwestycję”, the v2 panel) and what
  is left is: the full transfers table „Transfery” (filters, pagination, sort, „Drukuj”, „Faktury”
  ZIP, audit mode, edit/cancel), the temporary v1 reading (`?widok=v1`), the legacy Google Sheet
  button, „Poproś o opinię”, and the trash banner.
- **Three transaction lists already live in the editor's summary panel** — wpłaty (Podsumowanie),
  wydatki na materiały (Materiały), wypłaty (Podwykonawcy) — fixed-shape, unfiltered, server props.
  Nothing lists `LABOR_COST`, `RABAT`, `LOSS`, `BONUS`, cancellations or other types; only the page's
  table does.
- **The table does not drop into a tab as-is.** `TransferDataTable`, `TransferFilters` and
  `PaginationFooter` all read and write the URL, and the rows come from a server component that
  needs the page's `searchParams`. On `kosztorys_v2` a URL change re-renders the whole editor (an
  8-fetch page with an uncached tree), and every autosave already re-renders the route — a
  server-rendered list there would be re-sent on each debounced save (lesson EX-597, `lessons.md:662`).
- **The workable shape is a client-owned, on-demand list**: a paginated `'use server'` read called
  when the tab opens, pagination/filters in component state. Precedents exist
  (`TelmakCheckDialog`, `worker-report-history-table.tsx`), but there is no paginated `'use server'`
  transfers read and no state-driven variant of the filters yet — that is the real cost of the tab.
- **No investment is stranded by moving to the kosztorys** — `kosztorys_v2` exists for every
  investment and the panel mounts for the owner on an empty kosztorys. The only thing that genuinely
  lives nowhere else is the **v1 reading** of legacy robocizna/rabat booked as transfers, and that is
  temporary by construction (deleted when the owner calls the comparison over / EX-712).
- **No prior decision** in `context/` to retire or merge the page. History shows a steady drift of
  everything except the table into the editor (timeline below).
- **Retiring the page is ~40 call sites** (listing row click, transfers investment column, expense
  drafts, leads, kosz, kosztorysy list, the summary panel's own „Lista wpłat” links, crumbs) plus
  ~20 E2E specs.

**Recommendation: (a) now, (b) later — sequenced, not bundled.** Add the tab as a client-owned list
on the editor host only; keep the page as the full-featured transactions view until the tab reaches
parity and the v1 axis is deleted; then fold. Detail under _Recommendation_.

## Detailed Findings

### 1. What the investment page shows (inventory)

`src/app/(frontend)/inwestycje/[id]/page.tsx` — management only (`requireManagementPage()` at :35 →
ADMIN/OWNER/MANAGER). An EMPLOYEE is bounced to `/zaloguj` → `/` → his own `/pracownicy/[id]`.

| #   | Block                                                                                                                                                      | Also in the editor?                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Crumb: back arrow only (`@investmentCrumb/inwestycje/[id]/page.tsx:5`)                                                                                     | editor gets name + back (`investment-crumb.tsx:21-23`) |
| 2   | Heading `investment.name` (:79)                                                                                                                            | crumb                                                  |
| 3   | Trash banner „Inwestycja jest w koszu — tylko do odczytu…” (:80-85)                                                                                        | **no**                                                 |
| 4   | „Edytuj inwestycję” (`edit-investment-dialog.tsx`)                                                                                                         | yes — Inwestycja tab (`014269d3`)                      |
| 4   | „Poproś o opinię” (`request-review-button.tsx`, status Zakończona, not sent yet)                                                                           | **no**                                                 |
| 4   | `SheetButton` — legacy Google Sheet „Otwórz”/„Dodaj” (`sheet-button.tsx`)                                                                                  | **no**                                                 |
| 4   | „Otwórz kosztorys_v2”                                                                                                                                      | n/a                                                    |
| 5   | Info list (`buildInvestmentInfoFields`)                                                                                                                    | yes — shared builder                                   |
| 6   | Notes (`InvestmentNotes`, editable)                                                                                                                        | yes (`a64cc4cf`)                                       |
| 7   | Gallery „Zdjęcia i pliki” (`investment-assets-section.tsx`)                                                                                                | yes — Inwestycja tab                                   |
| 8   | v1/v2 toggle (`stats-version-toggle.tsx`), default v2                                                                                                      | no — temporary axis                                    |
| 9a  | `?widok=v1` → `FinancialStats` tiles (transactions plane; follows table filters)                                                                           | **no**                                                 |
| 9b  | v2 → `InvestmentSummaryPanel` = same `SummaryPanelContent`, `host="investment"`: only Podsumowanie/Materiały/Marża, no settings, `transactionLists: false` | yes — superset in editor                               |
| 10  | „Transfery” table (`TransfersSection`)                                                                                                                     | **no**                                                 |

v2 reconciliation scream (robocizna/rabat vs Σ `LABOR_COST`/`RABAT`) renders inside the Podsumowanie
tab (`blocks/settlement-summary.tsx:95-104`, `lib/kosztorys/reconciliation.ts:70`).

Cost side-note: in v2 the page still awaits `fetchFilteredByType` + `fetchCategoryBreakdowns` for
the v1 tiles on its critical path and throws the result away (`page.tsx:52-76`, used only at :113).

### 2. Transactions already in the summary panel (overlap)

`SummaryPanelContent` (`summary-panel-content.tsx:158`) has two hosts (`HOST_LAYOUT`, :60-77):
`editor` (all 6 views, `transactionLists: true`) and `investment` (3 views, lists off „because the
transfers table below this panel already lists every wypłata — as it does every wpłata”).

| Tab                          | Individual rows                                                                    | Types                                      | Source                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Podsumowanie                 | „Lista wpłat” `DepositsTable` (`summary-overview-tab.tsx:146-175`)                 | `INVESTOR_DEPOSIT`                         | `fetchDepositTransactionsForInvestment` (`queries/investment-transactions.ts:36`) |
| Materiały                    | „Lista wydatków” `MaterialsTransactionsTable` (`summary-expenses-tab.tsx:127-139`) | `INVESTMENT_EXPENSE`, `_NET`, `CORRECTION` | `fetchMaterialTransactionsForInvestment` (:63)                                    |
| Podwykonawcy                 | `SubcontractorPayoutsTable` (`subcontractor-summary.tsx:89-97`)                    | `PAYOUT` (BONUS filtered out)              | `fetchPayoutTransactionsForInvestment` (:19)                                      |
| Robocizna, Marża, Inwestycja | none (aggregates / info)                                                           | —                                          | —                                                                                 |

All three are cached under `collection:transactions`, passed as props from `kosztorys_v2/page.tsx`
(8-fetch `Promise.all`, :53-88), using their own row types (`types/transfers.ts:71-112`), not
`TransferRowT`. Every row links out to the investment page with query filters
(`deposits-table.tsx:70`, `materials-transactions-table.tsx:246`, `subcontractor-payouts-table.tsx:89-95`,
`summary-overview-tab.tsx:157`) — the panel already treats the page as „the full list”.

**A „Transakcje” tab would not replace these** — they are curated per-figure lists sitting next to
the figure they explain. It would add the full, all-types list.

### 3. Investments without a kosztorys

- `kosztorys_v2` is always reachable („every investment has one”, `kosztorys_v2/page.tsx:25-26`);
  the owner's panel mounts at any row count (`kosztorys-editor-body.tsx:267-268, 711-714`).
- So a „Transakcje” tab in the editor would show such an investment's transactions — including
  legacy `LABOR_COST`/`RABAT` rows, which are ordinary rows in the full list.
- What has no other home is the **v1 aggregate reading** (`FinancialStats`). It is temporary:
  `lib/constants/stats-version.ts:1-5` „Delete this whole axis once the owner calls the comparison
  over”; AGENTS.md: EX-712 removes `LABOR_COST`/`RABAT` booking and the v1/v2 columns once the
  rozjazd is zero everywhere. `investment-financials-and-discount.md:37-41`: „v1 renders the
  transactions plane … Legacy robocizna booked as transfers stays readable on v1.”

### 4. Entry points to `/inwestycje/[id]`

No central route builder; helpers `investmentTransfersHref` (`lib/utils/investment-transfers-href.ts:17-31`,
page + filter params), `expenseRowHref` (`lib/kosztorys/expense-datasets.ts:57`), `reportHref`
(`worker-report/report-param.ts:4`, → kosztorys_v2).

Callers targeting the **page**:

- Investments listing row click (`investment-data-table.tsx:64`) — the main entry
- Transfers table investment column (`tables/transfers.tsx:90`) — dashboard, `/kasa/[id]`, `/pracownicy/[id]`
- Expense drafts (`tables/expense-drafts.tsx:38`) — dashboard, `/zgloszenia-wydatkow`, worker page
- Kosztorysy list (`tables/sheets.tsx:33, 86`)
- Leads — promoted lead (`promote-lead-dialog.tsx:57`)
- Kosz (`trash/trashed-investment-links.tsx:12`)
- Editor crumb name link + back fallback (`nav/investment-crumb.tsx:21-23`)
- Summary panel row links (§2)
- URL readers: `use-investment-from-url.ts:9` (pre-fills deposit/expense forms — regex also matches
  `/kosztorys_v2`)

E2E: page targeted by `investment-panel-filters`, `investment-lock`, `investment-loss`,
`investment-expense-figures`, `kosztorys-route-guards`, and `waitForURL` after a listing click in
`kosztorys-presets`, `investment-planowana-status`, `investment-expense-netto`, `drivers/expenses.ts`.

No emails, share pages, command palette, sitemap or proxy rule references the page.

### 5. Reusing the transfers table

On the page: `TransfersSection` → `TransferTableServer` (async RSC) → `TransferDataTable` (client)
(`page.tsx:132-143`); scoped by `{ ...buildTransferFilters(sp), investment: { equals: id } }`
(:45-46); server pagination/sort from the URL; `findTransfersRaw` cached on `collection:transactions`
(`queries/transfers.ts:22-57`).

URL coupling that blocks a drop-in:

- sort: `useSearchParams` + `router.replace` (`transfer-data-table.tsx:45, 62-63, 98`)
- filters: `useUrlFilterParams(baseUrl)` (`transfer-filters.tsx:77-81`)
- pagination: `router.push ?page/limit` (`ui/pagination/pagination-footer.tsx:14-22`)
- rows: only from `TransferTableServer`, which needs parsed page `searchParams`

Reusable precedents:

- `TelmakCheckDialog` (`telmak-check/telmak-check-dialog.tsx:42, 106-109`) — client component,
  `getTransferColumns(...)` + generic `DataTable`, rows from a `'use server'` read
  (`lib/queries/telmak-check.ts:27-31`).
- `fetchFilteredTransfers` (`lib/queries/fetch-transfers-for-invoices.ts:26-60`) — `'use server'`,
  `requireAuth(MANAGEMENT_ROLES)`, client-supplied `Where`, **unpaginated**.
- State-held pagination: `worker-reports/worker-report-history-table.tsx:21-22, 36-37`
  („two URL-driven tables on one page would fight over page / limit / investment”).

Gaps: no paginated `'use server'` transfers read (though `findTransfersRaw` supports page/limit); no
state-driven `TransferFilters`; client-held rows don't refresh after an edit/cancel/booking unless the
tab refetches (lesson `lessons.md:681-686`: refetch only after a write that produced no render — here
the write DOES render the route, but the tab's rows are not part of that render).

Caveat from `lessons.md:577`: „A server action that accepts a caller-supplied `Where` can never be
relaxed for a public surface” — the new read must stay management-gated and the view
`clientVisible: false` (the panel also mounts in the client share view).

## Code References

- `src/app/(frontend)/inwestycje/[id]/page.tsx:35,45-46,52-76,79-143` — guard, table scope, v1 aggregates, blocks
- `src/components/kosztorys/summary/summary-panel-content.tsx:60-77` — `HOST_LAYOUT`
- `src/components/kosztorys/summary/summary-panel-content.tsx:273-352` — `SummaryScrollRegion` render branches
- `src/components/kosztorys/summary/model/summary-views.ts:25-58` — `SUMMARY_VIEWS`, `allowedSummaryViews`
- `src/components/kosztorys/summary/hooks/use-summary-view.ts:11,20-26` — persisted view (localStorage)
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:267-268,715-746` — panel gate + mount
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:44,53-88,98-106` — editor page fetches
- `src/lib/queries/investment-transactions.ts:19,36,63` — the three curated lists
- `src/lib/queries/transfers.ts:22-57` — `findTransfersRaw`
- `src/components/transfers/transfer-data-table.tsx:45-124` — URL-bound client table
- `src/components/transfers/transfer-filters.tsx:77-81` — URL-bound filters
- `src/components/telmak-check/telmak-check-dialog.tsx:42,106-109` — on-demand table precedent
- `src/components/worker-reports/worker-report-history-table.tsx:21-37` — state pagination precedent
- `src/lib/cache/revalidate.ts:24-33` — `deferRefresh` / why autosaves still render
- `src/lib/constants/stats-version.ts:1-10` — temporary v1/v2 axis
- `src/lib/utils/investment-transfers-href.ts:17-31` — page href helper

## Architecture Insights

- **One panel, two hosts, a capability table** (`HOST_LAYOUT`) — effectively a Strategy-by-config:
  a host declares what it offers, and the registry (`SUMMARY_VIEWS` + `requires` predicates) filters
  by audience. A new tab is one registry entry + one render branch + optional props; no i18n
  (labels are hard-coded Polish).
- **Server props vs client calc** follows „can it change mid-session” (`lessons.md:432`): transaction
  data is a server prop. A full, filterable, paginated list breaks that rule's assumption of a small
  fixed payload — it is the first panel content that must be fetched on demand rather than shipped
  with the route.
- **Every editor write renders the route** (`lessons.md:662`): even `deferRefresh` only relocates the
  render. Anything heavy placed in the editor's server tree pays on every autosave.

## Historical Context (from prior changes)

- `context/archive/2026-07-27-decouple-panel-write-refresh/change.md` — EX-597: goal was the page
  feeling „as fast as it did originally, when the investment page was transfers only”; „Opcje
  rozliczenia” moved into the editor.
- `context/archive/2026-08-08-summary-panel-filter-blind/change.md` — panel stopped following URL
  filters; „Suma wybranych transakcji” answers the filtered question.
- `lessons.md:646-659` — `?widok=` as a URL axis; „a comparison axis is temporary by construction”.
- `context/foundation/prd.md:234-237`, `roadmap.md:446,465` — FR-015 is a **write** firewall; a
  read-only list in the editor does not cross it.
- Page evolution (git log): recon block (07-19) → v2 panel + v1/v2 split (07-26) → settings moved to
  editor (07-27) → settings link deleted (08-07) → panel filter-blind (08-08) → print/CSV header
  export removed (08-12) → gallery (09-21) → editor „Inwestycja” tab with info + gallery + edit
  (09-22) → notes editable in both (10-08).

## Related Research

- `context/reference/kosztorys-editor-domain-notes.md:1072-1090` — EX-600 filter-scope design (removed 2026-08-08)
- `context/foundation/investment-financials-and-discount.md` — how marża/materiały/robocizna connect; v1 vs v2

## Recommendation

**(a) now, (b) later — sequenced** (`lessons.md:341`: don't bundle changes that redefine the same
surface).

1. **This change — add „Transakcje” to the editor host only.** `clientVisible: false`, not offered on
   the `investment` host (the page has the table). Client-owned: a new paginated, management-gated
   `'use server'` read wrapping `findTransfersRaw` with `investment` forced server-side; pagination in
   component state; reuse `getTransferColumns` + `DataTable` (Telmak precedent); refetch on open and
   after the tab's own edit/cancel. Filters: start with a minimal state-driven set (Typ, Pokaż
   anulowane) and a „Pełna lista” link to the page for filters/„Drukuj”/„Faktury”/audit.
2. **Cheap follow-up, independent:** the listing row click could go straight to `kosztorys_v2` — today
   it costs listing → page → „Otwórz kosztorys_v2”. A UX decision for the owner, not a refactor.
3. **Later change — fold the page**, gated on: the v1 axis deleted (owner ends the comparison /
   EX-712), the tab at parity (state-driven filters, print, invoice ZIP, audit mode), and homes for
   „Poproś o opinię”, the legacy `SheetButton`, and the trash banner. Then retarget ~40 call sites
   (most via `investmentTransfersHref` — one helper change) and ~20 E2E specs.

Option (c), skipping the tab, is defensible only if the answer to „where do I see all transactions
while in the kosztorys” is „one click away on the page” — which is the status quo the user is
pushing against.

## Open Questions

1. Does the editor host show the v1/v2 reconciliation scream too, or only the investment host?
   (Determines whether folding the page loses the scream.)
2. Is a cancelled original + its CANCELLATION row the right thing to show in an investment-scoped
   list? A CANCELLATION row carries no `investment` (`transfer-filters.ts:166-169`), so
   `showCancelled=1` shows struck-through originals but not the cancellation rows.
3. Should the tab offer the same columns as the page table (17) or a narrower set for the panel's
   width?
4. Side findings (not in scope, verify before acting):
   - Podwykonawcy's payouts list is titled „Lista wpłat” (`subcontractor-summary.tsx:90`) — same as
     the deposits list; looks like a mislabel for „Lista wypłat”.
   - Stale comment: `@investmentCrumb/inwestycje/[id]/[...rest]/page.tsx:1` says the detail page has
     no slot file; it does.
   - Stale prop comment on `settledBreakdown` („absent on … the editor”) — the editor passes it
     (`kosztorys_v2/page.tsx:105`).
   - In v2 the page computes the v1 aggregates on its critical path and discards them (`page.tsx:52-76`).
   - Editor's Inwestycja tab mounts `InvestmentNotes` without `readOnly` (`summary-investment-tab.tsx:26`)
     — check behaviour for a trashed investment.

## Follow-up Research 2026-10-11T20:10+02:00 — the filters decide

Agreed with the user: the filters are the deciding factor — a tab with a minimal filter set never
reaches parity, so the page can never fold. Looking at the seam itself:

- The filter state is already a **flat string map** shaped like `URLSearchParams`. The client writes
  it through one hook, `useUrlFilterParams(baseUrl)` (`src/hooks/use-url-filter-params.ts`), whose
  whole surface is `getMultiParam` / `updateParam` / `updateMultipleParams` / `isPending`, plus
  `useToggleSearchParam` for the two cancelled toggles.
- The server reads the same map: `buildTransferFilters(searchParams, userContext)`
  (`src/lib/queries/transfer-filters.ts:47`) turns it into a `Where`.
- So the URL is only the **storage** of a param map both ends already agree on. Swapping the storage
  (URL → component state) does not touch the filter logic on either side.

**Implication — an Adapter over the param source instead of a second filter UI:**
one interface (get / getMulti / update / updateMultiple / isPending), two implementations —
URL-backed (today's hook, unchanged behaviour) and state-backed (`useState` holding a
`URLSearchParams`). `TransferFilters`, the sort in `TransferDataTable` and the pagination footer take
the source instead of calling `useSearchParams`/`router` directly. The tab serialises its state map
and passes it to the new `'use server'` read, which runs the **same** `buildTransferFilters` with
`investment` forced server-side. Filters, sort and pagination reach parity at once; „Drukuj” /
„Faktury” already take a `where` via `fetchFilteredTransfers`.

Touch points to verify in the plan:

- `TransferFilters` also reads `searchParams` directly (`amount`, `id` — `transfer-filters.tsx:~83-84`)
  and via `useToggleSearchParam` — all must go through the source.
- `date-filters.tsx` uses the URL hook too (rendered inside `TransferFilters`).
- Other URL-hook consumers (`queue-filters`, `expense-drafts-data-table`, `worker-reports-data-table`,
  `leads-data-table`) keep the URL implementation — no change.
- `useUrlFilterParams` resets `page` on every write; the state implementation must keep that rule.

This also removes the hardest precondition for folding the page later (Recommendation step 3): the
tab and the page would run the same table on two param sources.

**User decision (2026-10-11):** the tab drops URL filtering — an accepted exception to the
„a filtered view is a link” rule (`use-url-filter-params.ts` doc comment). Filters, sort and
pagination in the tab live in component state; the page keeps URL filters. Costs accepted with it:
a filtered tab view is not shareable, does not survive a reload, and Back does not undo a filter.
Open for the plan: whether the tab **seeds its state once from the URL on mount**, so deep links
that carry filters today (`investmentTransfersHref` from expense drafts, the summary panel's
„Lista wpłat” rows) keep working after a later fold without re-rendering the editor per filter change.

## Decision 2026-10-11 — tab dropped, separate transactions page

The user dropped the „Transakcje” tab (and the state-only filters exception above). The direction is
a **separate per-investment transactions page**. The change was renamed from
`kosztorys-transactions-tab` to `investment-transactions-page`. The inventory (§1), the entry-point
map (§4) and the table internals (§5) carry over unchanged; the Recommendation and the filter-seam
follow-up above are superseded.

**Follow-up decision (user, 2026-10-11):** no new route — `/inwestycje/[id]` is the transactions
page (option A over a new `/inwestycje/[id]/transakcje`). Entry-point map §4 stays valid as is.
