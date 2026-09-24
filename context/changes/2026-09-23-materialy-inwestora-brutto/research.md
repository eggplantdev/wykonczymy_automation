---
date: 2026-09-23T21:18:18+02:00
researcher: Claude (Opus 5.5)
git_commit: 50369538199dceb49c25e372f9e25cf92bc7a102
branch: zamrozone-brutto-wydatku-netto
repository: wykonczymy
topic: "Materiały tab in the investor view — no „… netto" split in Wydatki inwestycyjne, brutto-only wydatki list"
tags: [research, kosztorys, summary, materialy, preview, investor-view, expense-net]
status: complete
last_updated: 2026-09-23
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Owner rulings on Q1/Q2, Q1 invariant verified, start-here section"
---

## Start here

**Decided (owner, 2026-09-23):**

- **Q1 — the investor's list shows Razem as Σ brutto**, knowingly different from „Materiały" in
  Podsumowanie. The gap is always in the investor's favour (they are billed less than the list
  total) — verified below, with one pathological exception.
- **Q2 — the breakdown keeps its columns** in the investor view: Netto / Brutto / Różnica when a
  stawka is set, single „Kwota" when not. Only the rows merge (one per category).

- **Q3 — no stawka: the breakdown stays as it is (A)** — single „Kwota", a netto invoice at its
  netto, while the list shows its brutto. The gap is the Q1 gap again: billed ≤ list.
- **Q5 — a settled netto invoice stays in the investor list** (at its brutto, like every row).

- **Q6 — the merged investor list gets a generic label** (no brutto / netto in it, e.g.
  „Materiały"); it also names the „Pobierz faktury" zip.

**Still open (settle in the plan):** Q7 (E2E update).
Q4 (Korekta row) is not a question, just a note.

**Next step:** `/10x-plan materialy-inwestora-brutto`. Rough phase cut:

1. Pure helper in `src/lib/kosztorys/` — price rows with `breakdownRowPair`, sum per category id;
   `MaterialsBreakdownTable` renders priced rows, merged when `preview`. Node spec first (TDD'able).
2. Investor wydatki list — one merged dataset, „Kwota" = `amount`, footer Σ `amount`, own archive
   label. First DOM spec for `MaterialsTransactionsTable` (none exists).
3. `e2e/client-share.spec.ts:232-284` rewritten for one tab (author or file to `e2e-backlog`).
4. Docs: `context/reference/kosztorys-editor-domain-notes.md` — the investor view of materiały.

### Q1 verified — the list Razem is never below the billed figure

List Razem − billed materiały = Σ over rows of (`amount` − billed share):

- **wydatek netto:** `amount − net_amount` ≥ 0 — `getNetAmountError`
  (`src/lib/utils/validation.ts:22-35`) refuses a netto above the brutto and a netto ≤ 0.
- **brutto row, no stawka:** billed = receipt → 0.
- **brutto row, stawka r:** receipt − receipt/(1+r) = receipt·r/(1+r) ≥ 0 for a positive receipt.

**Exception:** a negative korekta (invoice credit) on the brutto side with a stawka set is billed at
credit/(1+r), a _smaller_ credit than the list shows, so for that row the list sits below billed.
The total flips only if the brutto side's credits outweigh its purchases — not a real investment.
With a stawka set, the list Razem should equal the breakdown's Brutto Razem (both are Σ `amount`
over the billed rows), so the investor sees one brutto figure in two places and the Netto column
carries the billed one. **Pin it with a test in the plan**; it isn't asserted anywhere yet.

---

# Research: Materiały tab in the investor view

## Research Question

Podsumowanie → Materiały, **investor view only** (manager view unchanged):

1. „Wydatki inwestycyjne" must not break out a „Materiały wykończeniowe netto" row — show only
   budowlane / wykończeniowe / pozostałe + Razem.
2. The wydatki list must not split brutto / netto — brutto prices only.

## Summary

Both surfaces already know they are in the investor view through one prop, `preview`, threaded
`KosztorysEditorBody → KosztorysTotalsPanel → SummaryPanelContent → SummaryExpensesTab`. No role or
session is involved (the `(share)` layout has none). So the change is a **render-layer transform
gated on `preview`** in `summary-expenses-tab.tsx`; no SQL, no query, no cache key, no billed figure
moves.

- **(1) Breakdown:** the netto rows are a separate block appended by `buildMaterialsBreakdown`, but
  each carries the **same category `id`** as its brutto twin. Merge = price every row with
  `breakdownRowPair` (the netto row now prices from its invoice, `recordedGross` — the in-flight
  `zamrozone-brutto-wydatku-netto` change), then sum the pairs per `id`. Summing _after_ pricing
  keeps every column honest at any stawka and keeps Razem identical to today's, so Razem still equals
  „Materiały" in Podsumowanie.
- **(2) List:** in preview, collapse the `gross` + `net` datasets into one list with the single
  „Kwota" column = `amount` (the brutto, which for a netto row is the invoice brutto — never
  rate-derived). This one **does** move a total: Razem becomes Σ brutto, which no longer equals the
  billed „Materiały" whenever the investment has a wydatek netto. See Open Questions.

„other" = the real category **„Pozostałe koszty"** (id 3). Local DB (prod dump) has exactly three
categories: 1 Materiały budowlane, 2 Materiały wykończeniowe, 3 Pozostałe koszty — the migration only
seeds the first two; the third was added by hand.

## Detailed Findings

### Where the investor view lives

| Host                                                                                         | `preview` | Breakdown | Wydatki list                            |
| -------------------------------------------------------------------------------------------- | --------- | --------- | --------------------------------------- |
| `src/app/(share)/k/[token]/page.tsx` (public link)                                           | true      | shown     | shown                                   |
| `src/app/(share)/podglad-inwestora/[id]/page.tsx` („Podgląd dla inwestora", management auth) | true      | shown     | shown                                   |
| `inwestycje/[id]/kosztorys_v2/page.tsx` → `KosztorysEditorV2`                                | false     | shown     | shown                                   |
| `components/investments/investment-summary-panel.tsx`                                        | false     | shown     | hidden (`showTransactionLists={false}`) |
| `szablony/[id]/page.tsx`                                                                     | false     | empty     | empty                                   |

Both investor hosts get their data from `buildPreviewKosztorysEditorData`
(`src/lib/queries/preview-kosztorys.ts`), the same `deriveWholeInvestmentFinancials` +
`fetchMaterialTransactionsForInvestment` the owner uses — unstripped, by design (comment at
`preview-kosztorys.ts:25-30`). What `preview` already changes on this tab:

- `settledBreakdown` forced to `undefined` (`summary-panel-content.tsx:308`)
- settled rows dropped from the list (`clientVisibleExpenseRows`, `summary-expenses-tab.tsx:66-68`)
- no row links, no inline pricing control

`preview` never touches `materialsBreakdown` today — the investor sees exactly the manager's rows.

### (1) „Wydatki inwestycyjne" rows

- SQL: `sumCategoryByTypeSettled` (`src/lib/db/sum-transfers.ts:246-278`) — `SUM(amount)`,
  `SUM(net_amount)` per `expense_category_id, type, settled`.
- Mapper: `deriveCategoryBreakdowns` (`src/lib/db/investment-financials.ts:38-65`) — netto spend
  lands in `netCategoryCosts` (Σ `net_amount`) and `netCategoryGrossCosts` (Σ `amount`), and ALSO in
  `categoryCosts` at its netto.
- Builder: `buildMaterialsBreakdown` (`src/lib/queries/investment-financial-fields.ts:33-67`):
  - brutto rows (:41-50): `id` = category, `net` = `categoryCosts − netCategoryCosts` (the brutto,
    despite the name), `origin: 'gross'`
  - „Korekta (bez kategorii)" (:51-53): `id: null`, only when non-zero, may be negative
  - netto rows (:55-64): **same `id`**, `label: \`${name} netto\``, `net`= Σ`net_amount`,
`origin: 'netBilled'`, `recordedGross`= Σ`amount`. Deliberately a separate trailing block
    (:29-32).
- Pricing: `breakdownRowPair` (`src/lib/kosztorys/summary-economics.ts:32-38`) — brutto row crosses
  through the rate; netto row is `{ net, gross: recordedGross }` with a rate, `faceValue(net)` with
  none (owner Q1, 2026-09-23).
- Render: `MaterialsBreakdownTable` (`src/components/kosztorys/summary/tables/materials-breakdown-table.tsx`),
  one render site that matters: `summary-expenses-tab.tsx:114-116`. Key `${origin}-${id}` (:60) is
  what keeps the twins from colliding today.

**Merge shape.** The table computes pairs inside the component (`pairOf`, :42). A merged row can't
be expressed as a `MaterialsBreakdownRowT` without inventing a new `origin` — its brutto half moves
with the rate and its netto half doesn't. So the merge belongs **after** pricing: a pure helper in
`src/lib/kosztorys/` that takes `(rows, rate)` and returns `{ id, label, pair }[]` summed per `id`,
with the table rendering pairs. Manager view keeps the unmerged rows through the same path.
Candidate home next to `breakdownRowPair` in `summary-economics.ts`.

Per column, a merged category reads:

| Stawka                         | Netto                              | Brutto / Kwota                                         |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------ |
| set (Netto / Brutto / Różnica) | receipt ÷ (1+rate) + invoice netto | receipt + invoice brutto                               |
| none (single „Kwota")          | —                                  | receipt + invoice **netto** (what is billed, owner Q1) |

Razem is unchanged in both cases → still equals „Materiały" in Podsumowanie
(`summary-overview-tab.tsx:97-98`, `billedMaterials`).

### (2) Wydatki list

- Rows: `fetchMaterialTransactionsForInvestment` (`src/lib/queries/investment-transactions.ts:63-107`)
  — `amount` = invoice brutto (what left the kasa), `billed = billedAmountFor(type, amount, netAmount)`
  (`src/lib/constants/transfers.ts:492-496`) = `net_amount` for `INVESTMENT_EXPENSE_NET`, else
  `amount`. No rate is ever applied per row.
- Datasets: `src/lib/kosztorys/expense-datasets.ts` — `partitionExpenseRows` (:16-26, netto type →
  `net` before `settled`), `availableExpenseDatasets`, `sumBilled` (Σ `billed`, the footer),
  `clientVisibleExpenseRows` (:62-67, drops the `settled` set but **keeps a settled netto row**).
- Table: `materials-transactions-table.tsx` — toggle „Materiały brutto" / „Materiały rozliczane
  netto" / „Materiały wliczone w robociznę" (:39-43), `NET_COLUMNS` Netto + Brutto (:148-152),
  `GROSS_COLUMNS` single „Kwota" = `amount` (:155-158), footer = `sumBilled` with a netto-tab colSpan
  quirk (:229-244), invoice archive named after the active dataset label (:190).

**Change shape.** In preview: one dataset = `gross ∪ net` (settled already gone), `GROSS_COLUMNS`,
footer Σ `amount`, no toggle (one option — the toggle already hides at `options.length > 1`), archive
label needs a name that isn't „Materiały brutto" if it now contains netto invoices. `sumBilled` has
to become Σ `amount` for that render only — `billed` is still what the manager's netto tab needs.

## Code References

- `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:66-68,114-116,133-138` — the one place both surfaces are fed; `preview` already here
- `src/components/kosztorys/summary/summary-panel-content.tsx:301-318` — passes `preview`, drops `settledBreakdown`
- `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:42-44,60` — per-row pricing, row key
- `src/lib/kosztorys/summary-economics.ts:32-38` — `breakdownRowPair`
- `src/lib/queries/investment-financial-fields.ts:33-67` — `buildMaterialsBreakdown`, shared category id
- `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:148-158,168-190,229-244` — columns, datasets, footer
- `src/lib/kosztorys/expense-datasets.ts:16-26,45-47,62-67` — partition, `sumBilled`, client filter
- `src/lib/constants/transfers.ts:492-496` — `billedAmountFor`

## Architecture Insights

- **`preview` is the investor-view seam**, a plain prop, not auth. Every investor-only difference so
  far is a render filter over the same data (settled table hidden, settled rows filtered). This
  change fits that pattern exactly; nothing needs to move into the query layer.
- **Pricing-then-aggregation** (Strategy + fold): the row's `origin` selects its pricing strategy
  (`breakdownRowPair`), and the view only ever sums priced pairs. Merging before pricing would force
  a mixed-origin row type; merging after keeps each strategy intact.
- **Invariants under test:** Σ breakdown rows = `totalMaterialCosts` (`investment-financial-fields.test.ts`),
  gross Σ + net Σ of the list = `totalMaterialCosts` (`derive-financials-bucketing.test.ts:346-376`),
  breakdown Razem = Podsumowanie „Materiały" (`materials-breakdown-table.test.tsx`,
  `summary-economics.test.ts:78-79`). Change (1) keeps all three; change (2) deliberately breaks the
  third's list analogue for the investor render only.

## Historical Context (from prior changes)

- `context/archive/2026-07-24-netto-expense-type/` — netto type: leaves the kasa at `amount`, bills at stored `net_amount`.
- `context/archive/2026-07-25-kosztorys-client-invoices/` — wydatki list restored on `/k/`; invoices in the client's hands accepted.
- `context/archive/2026-07-26-netto-expenses-own-tab/` — netto rows got their own tab and their own Razem.
- `context/archive/2026-07-29-netto-expense-grossup/` — rate-derived brutto (ruling 2026-08-07), both money columns shown in preview too.
- commit `9eb472e4` (2026-08-19) — settled rows dropped from the client list; settled netto rows kept.
- `context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/` — netto row's brutto now comes from the invoice (`recordedGross`); owner Q1/Q2/Q3 rulings (`research.md:217-226`). P1–P3 committed (`0dbaeb40`, `14b8e58b`, `50369538`); **this change depends on it.**

## Related Research

- `context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/research.md`

## Open Questions

1. ~~**List Razem vs „Materiały".**~~ **Resolved (owner, 2026-09-23):** the investor sees Razem as
   Σ brutto; the gap to „Materiały" is in their favour (see Start here).
2. ~~**Breakdown columns in preview when a stawka is set.**~~ **Resolved (owner, 2026-09-23):**
   columns stay; only the rows merge.
3. **Breakdown with no stawka — Resolved (owner, 2026-09-23): A, keep as is.** The single „Kwota" column bills a netto invoice at its
   netto; the list next to it shows the invoice brutto. Options:
   - **A — keep as is.** Breakdown Razem = „Materiały" in Podsumowanie, ≤ the list Razem — the same
     in-the-investor's-favour gap as Q1 (confirmed: under A the investor always sees a billed figure
     at or below the list total). Downside: nothing on the page says _why_ it is lower.
   - **B — brutto breakdown.** Matches the list, breaks the tie to Podsumowanie / bilans. Worst.
   - **C — Netto / Brutto / Różnica whenever a netto invoice exists**, stawka or not. Every total
     ties to something on the page and Różnica shows the discount; reverses the 2026-09-23 Q1 ruling
     of `zamrozone-brutto-wydatku-netto` and should apply to the manager view too.
     Scope today: one netto invoice in the prod dump (inv. 146).
4. **„Korekta (bez kategorii)".** Kept as its own row in the merged view (it has no category to merge
   into). 0 uncategorised rows in the local dump — expected to be rare.
5. ~~**Settled netto row.**~~ **Resolved (owner, 2026-09-23): stays in the investor list** — it is
   still billed, so after the merge it appears among the other rows at its brutto. No change to
   `clientVisibleExpenseRows`.
6. ~~**Archive filename.**~~ **Resolved (owner, 2026-09-23): a generic label** for the merged
   investor list (no brutto / netto in it); the zip takes the same label.
7. **Tests.** No DOM spec for `MaterialsTransactionsTable` / `SummaryExpensesTab`;
   `e2e/client-share.spec.ts:232-284` asserts the two investor tabs exist and **will break** by
   design — owes an update.
