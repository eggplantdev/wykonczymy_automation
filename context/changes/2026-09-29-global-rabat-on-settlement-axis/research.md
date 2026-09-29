---
date: 2026-09-29T16:27:15+02:00
researcher: Claude (Opus 5.5)
git_commit: b921b9476ec505baf39a5fad9761e924400c4c52
branch: staging
repository: wykonczymy
topic: 'Rabat kwotowy on a brutto-settled investment — a UX/model where the owner types the figure he means'
tags: [research, kosztorys, rabat, global-discount, vat, settlement-mode, podsumowanie]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: rabat kwotowy on a brutto-settled investment

**Date**: 2026-09-29T16:27:15+02:00
**Git Commit**: b921b947 · **Branch**: staging · **Repository**: wykonczymy

## Research Question

On inv. 112 (Szeligowska 57b/7, rozliczenie brutto, VAT 8%) the owner types a rabat kwotowy of 5000
meaning 5000 zł off the bill; the Podsumowanie deducts 5400,00. The user rejects the current design
("makes no sense, very bad UI") and a first idea (the field follows the settlement mode + store the
axis). Find a clean model where the owner types the figure he means.

## Summary

- **Not a regression — a design assumption nobody ever put to the owner.** The kwota is stored
  netto and grosses by VAT in the brutto column (`settlement-summary.tsx:82`,
  `summary-economics.ts:55-62,84-102`). The owner's 2026-07-16 rulings on the global rabat covered
  kwota/procent, hiding the per-item columns and "odejmujemy od totalu"; "entered netto" was the
  plan's own inference ("every price in this editor is netto"). EX-539 asked exactly this question
  on 2026-07-19 and was closed 2026-07-21 by removing the `RABAT` transaction, not by an answer.
  Inv. 112 is EX-539's "1000 vs 1230" scenario on the kosztorys field.
- **The grossing rule itself is sound and stays.** A rabat is a cut in the price of prace; the VAT
  base is post-rabat labour (6fdbe6c5), so a rabat's netto and brutto differ by VAT, and only that
  keeps an invoice coherent (brutto = netto × (1+VAT)). The defect is only that the owner can
  express the kwota on one axis.
- **Recommended model — two linked fields, one stored netto (the user's direction).** The control
  shows „netto" and „brutto" side by side; typing in either writes the netto (`brutto / (1+VAT)` for
  a brutto entry) and the other field shows the derived counterpart live. **Every reader is
  untouched** — they all consume the stored netto today, and the grossing surfaces then produce
  exactly the brutto the owner typed. No migration, no new column, no axis tag.
- **"Fixed amount" (user) = a zł kwota, which the linked fields already are.** The legacy `RABAT`
  transfer was a zł amount (AGENTS.md: on the brutto plane it _grosses_ like this one — "a rabat is a
  concession on the price, so it grosses by VAT"). Face value on both axes (the strata pattern) was
  evaluated and rejected: it breaks brutto = netto × (1+VAT) on the invoice (inv. 112: 51 191,76 vs
  50 791,76 — a 400 zł gap).
- **One code obstacle:** `handleGlobalDiscountChange` rounds the kwota to cents on write
  (`use-kosztorys-settings.ts:255-265`). A brutto entry stored as a cent-rounded netto re-derives to
  within ~0,006 zł of what was typed, which can display a grosz off at 23%. Plan must pick: keep the
  cent rounding for the seeded Σ-rabatów path only and store the brutto-derived netto at higher
  precision, or accept the grosz.

## Detailed Findings

### Where the kwota lives and how it moves

- **UI:** `src/components/kosztorys/summary/settings/global-discount-control.tsx` — modes off /
  Kwotowy / % (the % is a one-shot write into every pozycja, EX-564, not stored state). Hint `:26`:
  „Kwota netto odejmowana raz od sumy wykonanych prac…". Field `:76-86` shows
  `roundToCents(globalDiscount.value)`. `changeMode` `:57-61` seeds Kwotowy with Σ per-item rabatów
  (netto, `calc.ts:49-56`).
- **Write:** `use-kosztorys-settings.ts:230-265` → `reversibleSettingSave` (undo entry) →
  `updateInvestmentGlobalDiscountAction` (`src/lib/actions/kosztorys.ts:78-84,200-217`; schema
  `z.enum(['amount']).nullable()` + `z.coerce.number().min(0)`, commented „value is netto PLN").
- **Storage:** `investments.global_discount_type` / `global_discount_value numeric`
  (`collections/investments.ts:145-158`, migration `20260716_1_…`). `numeric` holds any precision, so
  a higher-precision netto is a write-path decision, not a schema one.
- **Read-out:** `lib/db/kosztorys-tree.ts:95,114-115` → `queries/kosztorys.ts:89-92` →
  `v2-rows.ts:28,41`; type `GlobalDiscountT` (`types.ts:19-22`, „PLN netto").

### Every reader, and its axis

All read the same netto; the axis is chosen downstream (`MONEY_AXIS_BY_MODE`: NET→net,
GROSS→gross, MIXED→net).

| Surface                                                         | File                                                                                    | Treatment                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| Client-totals fold                                              | `settlement-client-totals.ts:54-70`; SQL twin `lib/db/kosztorys-client-totals.ts:65-85` | netto                                    |
| **Podsumowanie Rabat row**                                      | `settlement-summary.tsx:82` `moneyPair(-discountAmount, vatRate)`                       | **grossed**                              |
| **Łącznie / Pozostało do zapłaty**                              | `summary-economics.ts:55-62,84-102`                                                     | **grossed** (strata stays face value)    |
| Editor / podgląd inwestora / share link / investment page panel | same `SummaryPanelContent`                                                              | as above                                 |
| Listing                                                         | `shape-investments.ts:82` bilans netto, `:92` `balanceGross` grossed via `combinedPair` | mixed by column                          |
| Reconciliation                                                  | `reconciliation.ts:70-97`                                                               | netto vs Σ `RABAT` transfers             |
| Marża v2 / margin tab                                           | `margin-v2.ts`, `margin-actual-table.tsx:55-57`                                         | netto                                    |
| Protokół odbioru                                                | `acceptance-protocol/settlement.ts:29-84`                                               | netto in every mode                      |
| Offer PDF                                                       | `print/offer.ts:47-50`                                                                  | no global-rabat line; netto przedmiar    |
| History / versions                                              | `history/change-rows.ts:92-98`                                                          | raw netto, no grossing                   |
| Sheet compare                                                   | `build-sheet-comparison.ts:126-142`                                                     | netto                                    |
| Sheet import                                                    | `sheet-import/parse-labor-tab.ts:167-184`                                               | per-item **percent** only; never a kwota |
| Snapshots / szablony                                            | `serialize-tree.ts:21` display-only; `serialize-preset.ts:19,29-30` strips it           | —                                        |

Consequence for the linked-fields model: since the brutto a reader shows is `netto × (1+VAT)` and
the netto is `typed / (1+VAT)`, every grossing surface shows the typed brutto; every netto surface
shows the derived netto. Nothing downstream changes. The history row should arguably show the pair
(it shows raw netto today — on inv. 112 it would read 4629,63 for a 5000 brutto entry).

### Per-item rabat

- **Percent** (339 rows in prod, all in NET investments) is axis-free by linearity
  (`calc.ts:63` `gross·(1−p/100)` commutes with `toGross`). No action.
- **Kwota per pozycja** has the identical symptom (`calc.ts:58-66`; grid „Rabat kwota brutto" =
  typed × 1,08, `column-values.ts:67,72-73`) — **0 rows in prod**. Out of scope unless the plan
  wants symmetry; flag, don't build.

### Settlement mode

`investments.settlement_mode` NET/GROSS/MIXED flips freely; stored values never change, only the
projection. MIXED renders netto only. A brutto-typed kwota survives a mode flip (it is stored netto)
and a VAT change re-derives the brutto — the user explicitly accepts this ("if you change VAT then
obviously it changes"). No axis anchor needed.

### The owner's sheet

The sheet has no kwota rabat at all — only column R, a per-row percent (`S = N × cena − rabat`,
`lessons.md:318-320`). The zł rabat existed only as the `RABAT` transfer in the app's ledger. The
owner converts brutto payments ÷1,08 by hand in the sheet — i.e. he thinks brutto on brutto jobs,
which is the linked-fields case exactly.

## Options evaluated

|     | Model                                         | Verdict                                                                                         |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | **Two linked fields, store netto** (user)     | **Recommended.** UI + write path only; readers, tests of the grossing rule, DB untouched.       |
| B   | Field follows settlement mode, store axis tag | Superseded by the user: axis is the owner's choice. Adds a column and a branch in every reader. |
| C   | Face value on both axes (strata pattern)      | Rejected: invoice incoherence (inv. 112: 400 zł gap); contradicts the post-rabat VAT base.      |
| D   | Ryczałt / agreed final price, rabat derived   | Not what the user meant (resolved: "fixed amount" = the zł `RABAT` transaction).                |

### Option A — what the plan has to settle

1. **Precision on write.** `roundToCents` in `handleGlobalDiscountChange` exists for float residue
   in the seeded Σ rabatów (the „172024,28000000003" display bug). A brutto entry needs its netto
   kept past cents (e.g. `brutto / (1+VAT)` rounded to 6 dp) or the brutto can re-derive a grosz
   off. The no-op check compares the rounded value — keep it consistent with whatever precision
   is chosen.
2. **Field display.** Netto field `roundToCents(value)`; brutto field `roundToCents(toGross(value,
vat))`. On inv. 112: 4629,63 / 5000,00.
3. **Hint copy** `:26` („Kwota netto…") becomes wrong — rewrite.
4. **History row** — show netto/brutto pair or keep netto (decide).
5. **Inv. 112 data:** no migration. Stored 5000 netto stays until the owner retypes 5000 in brutto
   after deploy (→ netto 4629,63). Inv. 106 (NET, 2419) unaffected.
6. **Tests:** grossing specs (`summary-economics.test.ts:208-233`,
   `shape-investments.test.ts:225-258`) stay green — the rule is unchanged. New: a DOM spec for the
   control (type brutto → netto field + persisted netto; type netto → brutto field) under
   `src/__tests__/components/kosztorys/summary/settings/`, and a unit round-trip
   `toGross(fromBrutto(x)) === x` at 8% and 23%.

## Code References

- `src/components/kosztorys/summary/settings/global-discount-control.tsx:26,57-61,76-86` — the control
- `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:230-265` — optimistic save + cent rounding
- `src/lib/actions/kosztorys.ts:78-84,200-217` — schema + action
- `src/components/kosztorys/summary/blocks/settlement-summary.tsx:82` — Rabat row grossing
- `src/lib/kosztorys/summary-economics.ts:55-62,79-102` — Łącznie / do zapłaty; rabat vs strata rationale
- `src/lib/kosztorys/calc.ts:49-66,205,326-334` — seed, per-item apply, `toGross`, `globalDiscountAmount`
- `src/lib/queries/shape-investments.ts:82,92` — listing bilans netto/brutto

## Historical Context

- 2026-06-11 `RABAT` transfer created, face value, no VAT concept (`context/reference/superpowers/archive/2026-06-11-investment-rabat.md`); 2026-06 rows were balance plugs (`context/archive/2026-07-15-kosztorys-global-discount/change.md:57-63`).
- 2026-07-16 global rabat — owner: kwota or procent, subtracted from the total; "entered netto" is a plan inference (`git show 732d7a88^:context/archive/2026-07-15-kosztorys-global-discount/plan-brief.md:25-26`).
- 2026-07-19 ruling „Rabat też jest na płaszczyźnie prac — gruntuje się" (`domain-notes.md:654-659`, d40be6fc) — evidence is the percent column R, where the axis cannot matter.
- 2026-07-19/21 EX-539 opened, then "dissolved" (`domain-notes.md:712-718`, 090712dc).
- 2026-08-11 VAT base = post-rabat labour (6fdbe6c5). 2026-08-12 strata at face value (EX-675) — the explicit counter-pattern.
- 2026-08-18 EX-649 made `RABAT` transfers bookable again — the typed-axis question exists on v1 too; not examined here.

## Doc drift found (fix alongside, not scope)

- `AGENTS.md` — the canonical sheet `1kEWaMv9…` returns **403** for the reader service account; the "shared read-only" claim is false today.
- `context/reference/kosztorys-editor-domain-notes.md:656` — cites `S = N × cena − rabat` as proof a kwota grosses; in the sheet R is a percent. `:650-652`, `:684-686` stale.
- `context/foundation/roadmap.md:461-466` — EX-539 still listed as an open blocker.
- Stale comments: `settlement-mode-select.tsx:22-23`, `summary-overview-tab.tsx:51-52`.
- `calc.ts:243-244` attaches EX-495 to the rabat-in-offer question; EX-495 is „Pozostało" kwota vs procent.

## Open Questions

1. Precision: 6-dp netto for brutto entries vs accept a rare grosz (plan decides; recommend 6 dp).
2. History row: show the pair or netto only.
3. Per-item kwota rabat (0 rows) — leave, or give it the same linked pair for symmetry.
4. v1: how the gross bilans treats `RABAT` transfers typed in brutto (EX-649 reopened that axis) — separate issue if it matters.
