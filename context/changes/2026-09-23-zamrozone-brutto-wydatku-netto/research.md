---
date: 2026-09-23T20:44:02+02:00
researcher: Claude (Opus 5.5)
git_commit: ef2c8d080c78cff2b234994f07728d2696b37516
branch: spike/wydruk-oferty
repository: wykonczymy
topic: 'Frozen brutto for the netto-billed expense bucket in „Wydatki inwestycyjne” (kosztorys v2)'
tags: [research, kosztorys, summary, materialy, investment-expense-net, summary-economics]
status: complete
last_updated: 2026-09-23
last_updated_by: Claude (Opus 5.5)
---

# Research: frozen brutto for the netto-billed expense bucket

## Research Question

In the kosztorys v2 summary, the „Wydatki inwestycyjne" table has a „<kategoria> netto" row for
expenses booked as `INVESTMENT_EXPENSE_NET`. Its netto is frozen: it is Σ `net_amount`. Its brutto,
though, is derived as `toGross(netto, materiały rate)`, so changing the rate moves both the brutto
and the Różnica. The owner wants both amounts frozen to the invoice:

- brutto = Σ `amount`
- netto = Σ `net_amount`
- no rate may move either one.

The question: where does this brutto flow, what has to be plumbed, and which tests and decisions are
affected?

## Summary

- **The blast radius is small.** The derived netto-bucket brutto reaches exactly **two visible
  surfaces**, both on the „Materiały" tab:
  1. the „Wydatki inwestycyjne" table: Brutto and Różnica on each „… netto" row, and the Razem row;
  2. the expense pie beside it (`expensePieSlices`).

  These render identically in the v2 editor, on the investment page panel and on the client share /
  investor preview. **No billed figure reads it**: bilans (netto and brutto), Łącznie, „Pozostało do
  zapłaty", marża, the Podsumowanie „Materiały" row, the listing, the v1 tiles, the reconciliation,
  and the golden master / parity specs all go through `billedMaterials(...)` → `.net`. So the change
  is display-only. It moves no money figure.

- **The data is already there, and one function discards it.** All four SQL aggregations return
  both `SUM(amount)` and `SUM(net_amount)`. `billedTotalOf` → `billedAmountFor` keeps only the
  netto for this type. That matches the „carry both sums, pick above the query" lesson. The change
  needs **no SQL**: it needs a per-category brutto sum next to `netCategoryCosts`, carried onto the
  netto rows.
- **Real data proves the defect.** The only netto expense in prod (dump 2026-09-23) is inwestycja 146
  „Inna Chorna Postępu 4a". It is recorded as 4809,60 brutto / 4453,33 netto, i.e. 8% VAT. The
  investment's materiały rate is 23%, so the table prints 5477,60 brutto: 668 zł that never
  existed. That also explains the owner's „8%" remark: at a rate equal to the invoice VAT, the
  derived figure happens to coincide with the recorded one.
- **Decision history.** This reverses part of the 2026-08-07 owner ruling. That ruling weighed only
  **rates** as the bridge, never the stored `amount`. The netto type exists at all _because_
  storing a figure beats deriving it (`context/archive/2026-07-24-netto-expense-type/change.md:34-39`),
  which is the same argument, now applied to brutto.

## Detailed Findings

### 1. Where the brutto is derived

- `src/lib/kosztorys/summary-economics.ts:31-37`, `breakdownRowPair`: a `netBilled` row with a rate
  gives `{ net, gross: toGross(net, rate) }`; with no rate it gives `faceValue(net)`.
- `summary-economics.ts:66-70`, `materialsPair`: the aggregate, built from `breakdownRowPair`. Its
  **`.gross` has no reader outside tests.** The only non-test caller is `billedMaterials` (`:77-78`),
  which returns `.net`.
- `summary-economics.ts:112-130`, `computeAmountDue`: uses `faceValue(billedMaterials(...))`, so
  materiały enter both planes of Łącznie and amount-due at the billed netto. That is unaffected in
  every tryb.

### 2. Consumers (what changes)

| Consumer                                                                                                                            | Reads the netto bucket's brutto?     | Changes?              |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------- |
| `materials-breakdown-table.tsx:42-79` (Brutto / Różnica / Razem)                                                                    | yes                                  | **YES**               |
| `chart-slices.ts:84-95` `expensePieSlices` → `summary-expenses-tab.tsx:139`                                                         | yes (`.gross`)                       | **YES** (slice sizes) |
| Same table as „Materiały wliczone w robociznę" (`summary-expenses-tab.tsx:128-133`, `netRate={null}`)                               | no (settled rows are always `gross`) | no                    |
| Podsumowanie „Materiały", Łącznie, „Struktura kosztów" pie (`summary-overview-tab.tsx:97-98, 139-142`, `settlement-summary.tsx:83`) | no (`.net` as face value)            | no                    |
| `computeAmountDue` → „Pozostało do zapłaty" (both planes)                                                                           | no                                   | no                    |
| Listing `shape-investments.ts:45,59` (wydatki, bilans)                                                                              | no                                   | no                    |
| `materialsNetDiscount` → „Obniżka materiałów", v1 bilans, marża (`investment-financials.ts:92`)                                     | no (brutto bucket only)              | no                    |
| v1 `buildFinancialFields`, margin v2 tables, `deposit-planes.ts`                                                                    | no                                   | no                    |
| Offer print (`build-offer-print-html.ts`)                                                                                           | no materiały at all                  | no                    |
| Exports (PDF / CSV / xlsx)                                                                                                          | none found in `src`                  | n/a                   |

Hosts showing the changed table and pie: the kosztorys v2 editor (`kosztorys-editor-body.tsx:562`),
the investment page panel (`investment-summary-panel.tsx:84-104`), and the client share / investor
preview (`preview-kosztorys.ts` → the same `SummaryExpensesTab`).

### 3. The rate gate and the no-rate case

- Every host passes the stored `materialsNetRate`, gated by `effectiveMaterialsNetRate(settlementMode, rate)`
  (`settlement-mode.ts:67-72`, applied at `summary-panel-content.tsx:216`). **GROSS → null**;
  NET / MIXED → the rate.
- With `netRate == null` the table collapses to one „Kwota" column (`materials-breakdown-table.tsx:38,55`).
  The netto row then shows its **netto**, the figure the investor is billed. This follows the
  2026-08-07 ruling: „no rate, no crossing, on either axis".
- `e2e/kosztorys-route-guards.spec.ts:80-85` checks that the Podsumowanie „Materiały" pair appears in
  the Razem row. It matches Razem **Netto** (billed), so it holds under the change as long as the
  Netto column and the no-rate „Kwota" stay billed.

### 4. Data plumbing

- **SQL** returns `total` (Σ amount) and `netTotal` (Σ net_amount) in all four queries:
  - `src/lib/db/sum-transfers.ts:143-153`, mapped at :191-196;
  - `:154-165` per (investment, category, type, settled), mapped at :208-214;
  - `sumCategoryByTypeSettled` at :255-277;
  - `sumFilteredByType` at :291-312.
- **Where the brutto is dropped:** `investment-financials.ts:30` `billedTotalOf` → `billedAmountFor`
  (`constants/transfers.ts:492`). That feeds:
  - `deriveCategoryBreakdowns`, where `:47` builds `netCategoryCosts` from netto only;
  - `deriveFinancials`, where `:87` builds `materialsNetBilled`.
- **Producers:** only `deriveCategoryBreakdowns` / `deriveFinancials`, reached from three places:
  - `sumAllInvestmentFinancials` (`sum-transfers.ts:220-237`, the listing);
  - `inwestycje/[id]/page.tsx:58-65`;
  - `deriveWholeInvestmentFinancials` (`whole-investment-financials.ts:58-72`, used by the editor,
    the panel and the preview).
- **The row shape:** `buildMaterialsBreakdown` (`investment-financial-fields.ts:54-62`) builds the
  netto rows from `netCategoryCosts`. `MaterialsBreakdownRowT` (`types/investment-financials.ts:59-64`)
  is `{ id, label, net, origin }` and has no field for a recorded brutto.
- A netto row always has a category (`needsExpenseCategory`, `transfers.ts:550`). Σ per category
  therefore equals the aggregate.
- The netto type is `settleable: false` (`transfers.ts:211`), and both derivers ignore `settled` for
  it (`investment-financials.ts:51, 87`). The new brutto sum must follow the same rule.
- **`unstable_cache` keys whose payload would widen** (lesson: a widened shape needs a key bump):
  - `['category-breakdowns', …]` at `src/lib/queries/transfer-totals.ts:27`, if `CategoryBreakdownsT`
    gains an array;
  - `['investment-financials-v2']` at `src/lib/queries/balances.ts:67`, if `InvestmentFinancialsT`
    gains a field;
  - `['preview-kosztorys-editor-data']` at `src/lib/queries/preview-kosztorys.ts:96`, which carries
    `materialsBreakdown`.
- **The minimal path is per-row only.** Nothing reads the aggregate brutto, so a scalar such as
  `materialsNetBilledGross` is not needed. Neither is a new `MaterialsT` field or any prop drilling.
  What is needed:
  - a `netCategoryGrossCosts` next to `netCategoryCosts`;
  - a recorded-brutto field on the `netBilled` row;
  - `breakdownRowPair` reading that field.

  `materialsPair(...).gross` then either follows the same field or is removed as unread. That is a
  plan decision.

### 5. Tests pinning today's behaviour

**RED** (these encode the rate-derived brutto):

- `src/__tests__/lib/kosztorys/summary-economics.test.ts`:
  - `:68-72` (100 @ 0.23 → 123);
  - `:74-77` (round trip, which no longer exists);
  - `:79-85` (no rate → {100, 100});
  - `:94-96` (negative row);
  - `:104-108`, `:112-117` (`materialsPair` gross);
  - `:127-131`.
- `src/__tests__/lib/kosztorys/chart-slices.test.ts:20-25`: the netto slice ≈ 1230.
- `src/__tests__/lib/queries/investment-financial-fields.test.ts:130, 170-171`: `toEqual` on the
  exact row shape. This is a shape change, not a behaviour test.

**Tautology risk:** `chart-slices.test.ts:17-18, 20-30` compute the expected Razem with
`breakdownRowPair` itself. If both sides move together, the test stays green without testing
anything. Rewrite it with literals, red first.

**Blind to the change:**

- `investment-render-parity-db.test.ts:181-207`, `financial-golden-master-db.test.ts`,
  `derive-financials-bucketing.test.ts`: all netto / billed only;
- every E2E spec: none asserts the table's Brutto / Różnica or the Razem Brutto.

**Fixture trap:** every netto fixture sits exactly VAT-apart at 1.23:

- `seed-materials-net.ts:52-66`: 9840 / 8000 and 3075 / 2500, at rate 0.08;
- `seed-client-share.ts:123`: 1230 / 1000, no rate;
- `e2e/investment-expense-netto.spec.ts:24-25`.

At a materiały rate of 0.23, frozen and derived coincide, so a test there proves nothing. Test at
0.08 or null, or use an 8%-apart fixture like the real prod row. The comment at
`seed-materials-net.ts:52` („deliberately not VAT apart") is false.

## Code References

- `src/lib/kosztorys/summary-economics.ts:31-37`: `breakdownRowPair`, the one line that derives the brutto.
- `src/lib/kosztorys/summary-economics.ts:66-78`: `materialsPair` / `billedMaterials`; the aggregate `.gross` is unread.
- `src/lib/db/investment-financials.ts:30, 37-61, 87`: where Σ amount is dropped.
- `src/lib/queries/investment-financial-fields.ts:33-65`: `buildMaterialsBreakdown`.
- `src/types/investment-financials.ts:28-31, 53-64, 74-82`: `netCategoryCosts`, `MaterialsBreakdownRowT`, `CategoryBreakdownsT`.
- `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:38-79`: rendering, showNet, Różnica.
- `src/lib/kosztorys/chart-slices.ts:84-95`: pie on `.gross`.
- `src/lib/kosztorys/settlement-mode.ts:67-72`: the GROSS → null gate.
- `src/lib/queries/transfer-totals.ts:27`, `balances.ts:67`, `preview-kosztorys.ts:96`: cache keys.

## Architecture Insights

- The earlier design aimed for „one rate spans the bridge in both directions". That holds for the
  brutto rows: a receipt divided by the materiały concession is a real price the company chooses.
  For a netto row there is nothing to derive, because both ends of the bridge were typed off the
  invoice. The stored-figure argument that created the netto type applies to its brutto too.
- **Różnica means two different things.**
  - On a brutto row it is the materiały **concession** (receipt − billed).
  - On a frozen netto row it is the invoice **VAT** (netto − brutto), a figure the company never
    gives away.

  Razem Różnica sums the two. That was true before too, since the derived brutto was also VAT-like,
  but it becomes visible once the netto row stops moving with the rate. It is worth a word from the
  owner.

## Historical Context (from prior changes)

- `context/archive/2026-07-24-netto-expense-type/change.md:34-39`: netto is stored, not derived,
  to kill a rounding seam; „list == summary holds by construction".
- `context/archive/2026-07-29-netto-expense-grossup/change.md:14-16, 25-26, 40-43`: brutto =
  netto × (1 + stawka materiałów), with `vatRate` as the fallback (owner, 2026-07-29).
- `context/archive/2026-07-29-netto-expense-grossup/review-gate.md:26`: the 2026-08-07 ruling, „the
  materiały rate is the ONLY thing that crosses a netto-billed wydatek — no rate, no crossing, on
  either axis". Shipped in `f9aea081`. Related: `78d69202` (pie), `25ba41a9`, `d0512bbb`, `684b8b1b`.
- `context/reference/kosztorys-editor-domain-notes.md:527-536` is **stale**. It still states the
  pre-ruling VAT fallback. It must be rewritten when this change ships.
- Linear: EX-536 (netto type), EX-576 (owed netto E2E), EX-668 (the materiały-netto fixture).

## Owner rulings (2026-09-23)

- **Q2 — Różnica on a „… netto" row: kept.** A wydatek netto's brutto, netto and Różnica stay
  fixed whatever materiały rate is set (e.g. 12%): only the brutto rows move with the rate.
- **Q3 — the pie: removed.** The per-category „Wydatki inwestycyjne" pie on the „Materiały" tab
  (`expensePieSlices`, `summary-expenses-tab.tsx:139`) goes away. The overview's „Struktura kosztów"
  pie is a different chart and is not part of this ruling.
- **Q1 — keep today's behaviour.** With no materiały rate (or rozliczenie brutto) the table keeps its
  single „Kwota" column and a wydatek netto shows its netto there (what the investor pays), so Razem
  still equals the Podsumowanie „Materiały" row. The frozen brutto matters only when a rate is set.

## Open Questions (for the owner, in sheet vocabulary) — all resolved above, 2026-09-23

1. **No rate / rozliczenie brutto:** the table shows a single „Kwota" column, and a wydatek netto
   shows its netto there (what the investor pays).
   - Should it stay that way?
   - Or should a wydatek netto always show both amounts from the invoice, even when no stawka is set?
2. **Różnica on a „… netto" row:** once frozen, it is the invoice's VAT, not an obniżka.
   - Keep it in the column and in Razem?
   - Or leave it blank for netto rows?
3. **The pie:** with frozen brutto, the netto slices use the invoice brutto. Confirm this is the
   plane the owner wants the shares on.
