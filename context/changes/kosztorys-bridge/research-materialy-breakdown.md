# Research — Materiały breakdown for the kosztorys v2 „Podsumowanie" (v1 parity)

> Goal: let the owner decide the exact rows the v2 „Podsumowanie" „Materiały" panel shows and how
> they sum, by extracting how v1 ALREADY reconciles every material bucket. Two v1 sources:
> (a) the live Google Sheet mirror tabs, (b) the in-app financial-fields code that feeds the
> investment detail page. Recommendation: port v1 verbatim, don't design fresh math.
>
> No implementation code was changed by this research.

---

## 1. The bucket table — every material-related figure

All figures below are derived by `deriveFinancials` (`src/lib/db/investment-financials.ts:34-53`)
and `deriveCategoryBreakdowns` (`:16-27`) from raw `(type, settled, category)` sums off the
`transactions` table. The classifying predicate for "is this a material-expense row" is
`isExpensesTabType` (`src/lib/constants/transfer-rules.ts:18-19`), i.e. membership in
`EXPENSES_TAB_TYPES = ['INVESTMENT_EXPENSE', 'CORRECTION']`
(`src/lib/constants/transfers.ts:98-101`).

| Figure                   | Source predicate (file:line)                                                                                                        | settled flag       | In `totalMaterialCosts`?                                                                | In bilans?                                      | In marża?                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `totalMaterialCosts`     | `isExpensesTabType(type) && !settled` — i.e. `Σ(INVESTMENT_EXPENSE + CORRECTION)` unsettled (`investment-financials.ts:41`)         | **unsettled only** | — (it IS the total)                                                                     | **yes**, lowers it (`calculate-balance.ts:6-8`) | no (pass-through)                                |
| `categoryCosts[]`        | per-category `Σ` of `isExpensesTabType && !settled`, keyed by `expense_category_id` (`investment-financials.ts:16-26`, live bucket) | unsettled only     | **yes** — subset of it, only rows that HAVE a category                                  | yes (via total)                                 | no                                               |
| uncategorised remainder  | `totalMaterialCosts − Σ categoryCosts` (`map-category-costs.ts:25-26, 53-54`)                                                       | unsettled only     | **yes** — the part of the total with `expense_category_id IS NULL` (legacy corrections) | yes (via total)                                 | no                                               |
| `totalCorrections`       | `type === 'CORRECTION' && !settled` (`investment-financials.ts:42`)                                                                 | unsettled only     | **yes** — CORRECTION folds INTO `totalMaterialCosts`; **not a separate addend**         | yes (via total)                                 | no                                               |
| `totalSettled`           | `isExpensesTabType(type) && settled` — `Σ(INVESTMENT_EXPENSE + CORRECTION)` settled (`investment-financials.ts:50`)                 | **settled only**   | **NO** — leaves the material total                                                      | **NO** — off the client bill                    | **yes**, lowers marża (`calculate-margin.ts:14`) |
| `settledCategoryCosts[]` | per-category `Σ` of `isExpensesTabType && settled` (`investment-financials.ts:16-26`, settled bucket)                               | settled only       | no                                                                                      | no                                              | yes (via `totalSettled`)                         |

Key facts to carry into the design:

- **CORRECTION is categorisable OR uncategorised.** The form requires a category on a CORRECTION
  only when it has an investment (`needsExpenseCategory`, `transfer-rules.ts:71-73`). Legacy
  corrections predating that rule have `expense_category_id IS NULL` and fall into the
  uncategorised remainder (comment at `map-category-costs.ts:48-52`).
- **CORRECTION may be negative** (invoice credit) — it lowers `totalMaterialCosts` and can make the
  uncategorised remainder negative (`map-category-costs.ts:27` guards `!== 0`, not `> 0`).
- **settled (`materiały wliczone w robociznę`) is fully split out** of the material total and the
  bilans; it exists only to lower marża. It carries its own per-category split
  (`settledCategoryCosts`).

Reconciliation identity (holds by construction — `deriveCategoryBreakdowns` and `deriveFinancials`
consume the same predicate):

```
totalMaterialCosts = Σ categoryCosts[c]  +  uncategorised remainder
                   = (categorised INVESTMENT_EXPENSE+CORRECTION, unsettled)
                   + (uncategorised INVESTMENT_EXPENSE+CORRECTION, unsettled)

totalSettled       = Σ settledCategoryCosts[c]        (separate plane, off bilans, in marża)
```

---

## 2. How v1 renders it (in-app detail page)

`src/app/(frontend)/inwestycje/[id]/page.tsx:62-66,91-97` →
`buildFinancialFields` + `buildSettledFields` → `FinancialStats`.

**`buildFinancialFields`** (`map-category-costs.ts:43-77`) emits the client-facing „Koszty
inwestora" rows:

1. One row **per expense category** (`Materiały budowlane` / `Materiały wykończeniowe` /
   `Pozostałe koszty`), value = `costForCategory` (0 if none) — `mapCategoryCostsToFields`
   (`:32-40`).
2. **`Korekta (bez kategorii)`** — the uncategorised remainder, ONLY when `!== 0`
   (`:53-66`). This is the exact label v1 uses for the uncategorised-correction leftover.
3. Then `Robocizna`, `Wpłaty`, and `Rabat` (rabat only when `!== 0`).

These rows are what `FinancialStats` sums into „Bilans inwestora" (the category rows +
`Korekta (bez kategorii)` all carry `amount: -total`, `financial-stats.tsx:82-84`). So the
material portion of the bilans = the per-category rows + the uncategorised-correction row — nothing
else.

**`buildSettledFields`** (`map-category-costs.ts:81-89`) emits settled material as **its own
block**, per category, positive amounts, **only categories with a non-zero settled total**
(`.filter(total !== 0)`). `FinancialStats` renders it under its own heading
`SETTLED_TYPE.label = 'Materiały wliczone w robociznę'` (`transfers.ts:53-56`,
`financial-stats.tsx:125-139`), explicitly OUTSIDE the bilans toggle sum and labelled by tooltip as
"Obniżają marżę, ale nie obciążają bilansu inwestora" (`:39-41`).

**Answer to the two explicit questions:**

- **Does v1 show settled material as its own line?** YES — a separate labelled block
  („Materiały wliczone w robociznę"), never folded into the materiały/bilans figure.
- **How is the uncategorised-correction remainder labelled in v1?** `Korekta (bez kategorii)`
  (`map-category-costs.ts:61`).

---

## 3. How v1 renders it (the Google Sheet mirror) — filled test sheet

Inspected `SHEET_ID=1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4` (creds/network OK).

**`Podsumowanie` tab** (top summary block):

```
r05: Działanie | Kwota | Udział %
r06: Robocizna | =kosztorys_robocizny!S395 | =B6/$B$8
r07: Materiały | =kosztorys_robocizny!S398 | =B7/$B$8
r08: Łącznie   | =B6+B7
```

So the client-facing „Materiały" in the Podsumowanie is a **single figure** (`B7`), not itself
split. It chains through the robocizny sheet into the wydatki mirror.

**`wydatki inwestycyjne (tylko do odczytu)` tab** — this is where the split actually lives
(row 3 formulas, `SUMIF` over category column `C`):

```
H (RAZEM)               = SUM(E:E)                                  ← ALL expense amounts
I (Pozostałe koszty)    = SUMIF(C:C; "Pozostałe koszty"; E:E)
J (Materiały budowlane) = SUMIF(C:C; "Materiały budowlane"; E:E)
K (Materiały wykończ.)  = SUMIF(C:C; "Materiały wykończeniowe"; E:E)
```

The Podsumowanie's single „Materiały" figure resolves (per domain notes `:109-113`) to
`H = SUM(E:E)` on this mirror — i.e. **total INVESTMENT_EXPENSE**. The three-way split
(budowlane / wykończeniowe / Pozostałe koszty) sits one tab deeper as `SUMIF` per category — the
exact same three expense categories the in-app `categoryCosts` splits on.

**settled material in the sheet** lives on a **separate tab** — `rozliczone R+M (tylko do
odczytu)` — with the identical `H/I/J/K` (`SUM`/`SUMIF`) columns. It is NOT part of the
`wydatki inwestycyjne` total that feeds the Podsumowanie „Materiały". So the sheet ALSO keeps
settled material as its own separate surface, matching the in-app `buildSettledFields`.

**Correction in the sheet:** corrections route onto the same `wydatki inwestycyjne` tab as
INVESTMENT_EXPENSE (`EXPENSES_TAB_TYPES`, `transfers.ts:98-101`; `CORRECTION_MOVED_LABEL`
mechanism `:103-107`), so a categorised correction lands in one of the `SUMIF` buckets and an
uncategorised one only in `H = SUM(E:E)` — the sheet's structural equivalent of the in-app
"folds into the total but not into any category row" behaviour.

**Caveat:** per AGENTS.md the filled test sheet has some broken formulas; the `B6/B7` refs here
point at `S395/S398` (item rows) rather than grand-total rows, a known template rot
(`domain-notes.md:120-123`). The FORMULA SHAPE (`SUM(E:E)` + three `SUMIF`) is the reliable spec;
the specific rendered zł totals are not.

---

## 4. What the v1 client actually saw

- A single **„Materiały"** figure in the Podsumowanie (= total investment expense, `SUM(E:E)`),
  contributing to „Łącznie" alongside „Robocizna".
- Behind it, a **three-category split** (Materiały budowlane / Materiały wykończeniowe / Pozostałe
  koszty) on the wydatki mirror — the same three categories the app already splits on.
- **Settled material („materiały wliczone w robociznę") was NEVER part of the client-facing
  materiały figure.** In the sheet it's a separate `rozliczone R+M` tab; in the app it's a
  separate `buildSettledFields` block off the bilans. It is a margin concept, not a client-bill
  concept — confirmed by `investment-financials-and-discount.md:60-71` and the marża tooltip.

---

## 5. Recommendation — exact „Podsumowanie" „Materiały" rows (port v1 verbatim)

Port the **in-app v1 rule** (`buildFinancialFields`, `map-category-costs.ts:43-77`) into the
podsumowanie — it already reconciles every bucket and is the same rule the sheet expresses with
`SUM`+`SUMIF`. The already-added `buildMaterialyBreakdown` (`map-category-costs.ts:16-29`) is
essentially this rule minus the labor/wpłaty/rabat rows, and it is correct. Map v1 → podsumowanie:

| Podsumowanie „Materiały" row | Value                                                         | v1 source to port                                                                    |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Materiały budowlane`        | `costForCategory(categoryCosts, id)`                          | `mapCategoryCostsToFields` (`:32-40`) / sheet `J = SUMIF(...,"Materiały budowlane")` |
| `Materiały wykończeniowe`    | `costForCategory(...)`                                        | same / sheet `K`                                                                     |
| `Pozostałe koszty`           | `costForCategory(...)`                                        | same / sheet `I`                                                                     |
| `Korekta (bez kategorii)`    | `totalMaterialCosts − Σ categoryCosts`, **only when `!== 0`** | `buildFinancialFields:53-66` — reuse the EXACT label `Korekta (bez kategorii)`       |
| **Σ = „Materiały" total**    | `totalMaterialCosts`                                          | equals Podsumowanie `B7` / mirror `H = SUM(E:E)`                                     |

Rules to carry over verbatim:

1. **Emit all category rows even at 0** (v1 `mapCategoryCostsToFields` maps every category), so the
   panel shape is stable — matches the sheet, which shows 0-value categories.
2. **Uncategorised remainder → label `Korekta (bez kategorii)`, drop when 0** (v1 `:58-66`,
   `buildMaterialyBreakdown:27`). Do NOT invent a new label; parity depends on reusing this one.
   It can be negative (negative CORRECTION) — keep it as a signed row, don't `Math.abs`.
3. **The rows MUST sum to `totalMaterialCosts`** so the podsumowanie „Materiały" reconciles
   byte-for-byte with the investment detail page's bilans material portion. `buildMaterialyBreakdown`
   already guarantees this by construction (remainder = total − categorised).

**Settled material — surface it, but SEPARATELY (or not at all):**

- v1 (both planes) keeps settled material **out of** the client-facing materiały figure. For
  strict parity the podsumowanie „Materiały" total must **exclude** settled — which it does, since
  it's built from `totalMaterialCosts` (unsettled). **Do not add settled into the materiały sum.**
- If the owner wants settled visible in the podsumowanie at all, port `buildSettledFields`
  (`:81-89`) as a **separate block** under the heading `SETTLED_TYPE.label`
  („Materiały wliczone w robociznę"), positive amounts, per non-zero category — never merged into
  the Materiały rows. This mirrors both the sheet's `rozliczone R+M` tab and the detail page's
  settled block.
- Given the podsumowanie is the **client-facing offer** (domain-notes `:214-217` — export shows
  client prices only, no margin), the safest v1-parity default is to **omit settled from the
  podsumowanie entirely** (it's a margin figure, owner-only). Surface it only if the owner
  explicitly wants an internal variant.

---

## 6. Open questions for the owner (need a domain decision, not code)

1. **Should the podsumowanie „Materiały" show the three-category split, or just one „Materiały"
   line like the sheet's `B7`?** The sheet's Podsumowanie shows a single figure; the split lives a
   tab deeper. The in-app detail page shows the split. Both are "v1" — pick which granularity the
   podsumowanie mirrors. (Recommendation: show the split, it's strictly more informative and still
   reconciles.)
2. **Settled material in the podsumowanie: omit, or separate block?** v1 never folds it into the
   client materiały. Recommendation: omit from the client-facing podsumowanie; add an owner-only
   separate block only on request.
3. **Label for the uncategorised remainder** — v1 uses `Korekta (bez kategorii)`. Confirm this is
   acceptable in the podsumowanie context (it's a correct description but reads as an internal
   accounting term on a client offer).
   </content>
