---
date: 2026-09-24T12:05:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 8a6552c5b2e5ff948782bcb52b376a5c34b45062
branch: staging
repository: wykonczymy
topic: "Wydatek netto przy rozliczeniu materiałów brutto — billed at the invoice brutto so the investor's list Razem equals the summary"
tags:
  [
    research,
    kosztorys,
    summary,
    materialy,
    investment-expense-net,
    settlement-mode,
    billed-materials,
    investor-view,
  ]
status: complete
last_updated: 2026-09-24
last_updated_by: Claude (Opus 5.5)
---

# Research: wydatek netto under rozliczenie materiałów brutto

## Research Question

A wydatek netto (`INVESTMENT_EXPENSE_NET`, the „Materiały wykończeniowe netto" / „Materiały
budowlane netto" rows) is billed at its invoice netto in every mode. The documented consequence is
that when materiały are settled brutto, the investor's „Lista wydatków" Razem (Σ brutto) and the
summary's Razem („Materiały", billed) diverge. The owner wants the netto expense counted at its brutto
in that mode, frozen at the invoice's VAT, so that the list always equals the summary.

## Summary

1. **„Rozliczenie brutto" has two meanings in the UI, and the code treats them as one.**
   - Tryb `settlementMode = GROSS` („Robocizna — Rozliczenie robocizny").
   - The materiały select „Sposób rozliczenia materiałów" = „Brutto", i.e. `materialsNetRate = null`
     (the default).

   `effectiveMaterialsNetRate` (`src/lib/kosztorys/settlement-mode.ts:67-72`) turns GROSS into
   `null`, so every surface only ever sees „effective rate is null". The owner's phrase „ustawienie
   materiałów na rozliczenie brutto" is the second one. **The rule must key on effective rate ==
   null.** Keyed on tryb GROSS alone it would fix no live data:
   - The only wydatek netto (inv. 146) is NET with no rate.
   - The E2E seed is MIXED with no rate (`src/scripts/seed-client-share.ts:41`).
   - 0 GROSS investments have a wydatek netto.

2. **„Zamrożony wg stawki VAT, jak została tam ustawiona" = the stored `amount`.** A wydatek netto
   stores no VAT rate. The owner types both amounts off the invoice
   (`src/collections/transfers.ts:88-114`, `line-items-field.tsx:274-286`), and `amount` is
   write-once. The invoice's own VAT is implied as `amount / net_amount − 1` (inv. 146: 8,00%).
   The alternatives would re-derive a brutto nobody paid, the defect fixed yesterday:
   - netto × (1 + robocizna `vat_rate`);
   - netto × (1 + materiały rate).

   So: **bill = `amount`**.

3. **This is a billing change, not a display change.** Yesterday's two changes were display-only.
   This one moves every figure that reads the billed materiały: „Materiały", „Łącznie", „Pozostało
   do zapłaty", the „Struktura kosztów" pie, bilans v2 on the listing, and bilans v1
   (`calculateBalance`). **Marża does not move**: `calculate-margin.ts` never reads
   `totalMaterialCosts` / `materialsNetBilled`, and `margin-v2.ts` has no materiały term.
   Live impact: inv. 146, **+356,27 zł** owed by the investor (4809,60 − 4453,33).

4. **The UI copy already promises the requested behaviour, and the code contradicts it.**
   - `src/components/kosztorys/summary/materials-pricing-options.ts:14`: „Wydatki inwestycyjne
     rozliczane po kwotach brutto z faktury (domyślne)."
   - `:22`: „Przy rozliczeniu brutto inwestor płaci pełne kwoty z faktur…"

   The change aligns the arithmetic with the words the owner already sees.

5. **It reverses three recorded rulings** (see Historical Context). The owner is the one asking, so
   this is a confirmation rather than a blocker. The domain notes must be rewritten in the same
   change.

6. **The natural seam is `deriveFinancials`.** It already receives both `materialsNetRate` and
   `settlementMode` (`src/lib/db/investment-financials.ts:79-86`) and already applies
   `effectiveMaterialsNetRate` for `materialsNetDiscount` (:97-100). Picking Σ `amount` instead of
   Σ `net_amount` for `materialsNetBilled` there moves the listing, v1 and v2 together. SQL already
   returns both sums (`TypeSettledTotalT.total` / `.netTotal`), so no SQL or migration is needed.
   Four other definitions of „billed" must follow, or they drift (see Detailed Findings §4).

## Detailed Findings

### 1. Pricing today, per mode

| Mode                                   | Brutto receipt (`materialsGrossBase`) | Wydatek netto                                 |
| -------------------------------------- | ------------------------------------- | --------------------------------------------- |
| GROSS (rate forced to null)            | receipt at face value                 | `net_amount`                                  |
| NET / MIXED, rate set                  | receipt ÷ (1 + rate)                  | `net_amount`, frozen; brutto shown = `amount` |
| NET / MIXED, no rate („Brutto" select) | receipt at face value                 | `net_amount`                                  |

Sources:

- `billedMaterials = billedMaterialsPair(grossBase, rate).net + netBilled`
  (`src/lib/kosztorys/summary-economics.ts:49-51`)
- `breakdownRowPair` null-rate branch returns `faceValue(row.net)`
  (`src/lib/kosztorys/breakdown-rows.ts:10-13`)
- `billedAmountFor` has no mode parameter (`src/lib/constants/transfers.ts:492-496`)

### 2. Every investor-visible total, today

Symbols (unsettled rows only):

- G = Σ `amount` of brutto expenses and categorised korekty
- K = the uncategorised remainder
- N = Σ `net_amount` of wydatki netto
- A = Σ `amount` of wydatki netto
- r = the effective rate

| Figure                         | Formula                                                 | Source                                                                          |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Podsumowanie „Materiały"       | r: (G+K)/(1+r) + N; null: G+K+N                         | `summary-overview-tab.tsx:97-98` → `billedMaterials`                            |
| Łącznie / Pozostało do zapłaty | robocizna + materiały at face value − wpłaty − strata   | `summary-economics.ts:55-62, 84-111`                                            |
| Breakdown Razem                | r: Netto (G+K)/(1+r)+N, Brutto G+K+A; null: Kwota G+K+N | `breakdown-rows.ts`, `materials-breakdown-table.tsx:47-48,73-80`                |
| Investor list Razem            | G+K+A (`sumAmount` over `clientVisibleExpenseRows`)     | `materials-transactions-table.tsx:179-185,255-257`, `expense-datasets.ts:51-53` |

Gap, list Razem − comparable summary figure:

| Expense mix                                                  | No effective rate (Kwota = Materiały) | Rate set, vs Netto (= Materiały) | Rate set, vs Brutto |
| ------------------------------------------------------------ | ------------------------------------- | -------------------------------- | ------------------- |
| brutto receipts only                                         | 0                                     | G·r/(1+r)                        | 0                   |
| + wydatek netto                                              | **A − N** ← the reported divergence   | G·r/(1+r) + (A − N)              | 0                   |
| + korekta (either sign), settled rows, settled wydatek netto | 0                                     | as above                         | 0                   |

- **With a rate**, the list already equals the breakdown's **Brutto Razem** by construction, but no
  test asserts it. Each side is pinned with a different fixture:
  - `materials-breakdown-table.test.tsx:63-70`
  - `materials-transactions-table.test.tsx:56-59`
- **With no rate**, the only gap is A − N, and it exists only when a wydatek netto exists.

### 3. After the rule (no effective rate → wydatek netto billed at `amount`)

With no effective rate, list Razem = Kwota Razem = „Materiały" = G+K+A.

- All terms are sums of 2-decimal values, so they agree to the grosz.
- Settled rows are excluded everywhere.
- A settled wydatek netto is kept everywhere: it is `settleable: false`, and `materialsNetBilled`
  ignores `settled` (`investment-financials.ts:90-92`).

With a rate set, nothing changes: the netto row stays `{ net: N, gross: A }`.

Residual mismatches the plan must close or accept:

- **Legacy uncategorised wydatek netto** (0 rows; the form requires a category). K is derived from
  `totalMaterialCosts` in `buildMaterialsBreakdown` (`investment-financial-fields.ts:22-25`), so it
  follows only if `totalMaterialCosts` moves.
- **The manager list's netto tab footer.** `sumBilled` over `row.billed` is fixed in the query
  (`src/lib/queries/investment-transactions.ts:85-89`), so it stays at N. The manager's
  „brutto tab + netto tab = breakdown Razem" invariant then breaks silently.
- **The sheet sync.** It writes `billed = billsNetAmount ? netAmount : amount`
  (`src/lib/google/tab-rows.ts:56`) with no knowledge of the investment's materiały mode.

### 4. Definitions of „billed" that must stay in step

| #   | Definition                                                                                                            | Knows mode / rate?                                                | Action                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `deriveFinancials` → `materialsNetBilled`, `totalMaterialCosts` (`investment-financials.ts:79-105`)                   | **yes, both**                                                     | **Home of the rule.** Pick `r.total` vs `r.netTotal` by `effectiveMaterialsNetRate(...) == null`.                                                                                                     |
| 2   | `deriveCategoryBreakdowns` → `categoryCosts` (netto row at N), `netCategoryCosts`, `netCategoryGrossCosts` (`:37-66`) | no, and cached (`category-breakdowns-v2`, **tag transfers only**) | Must not become mode-dependent inside that cache. Reprice downstream, or `buildMaterialsBreakdown` puts A − N into a spurious „Korekta" row (its brutto rows are `categoryCosts − netCategoryCosts`). |
| 3   | `breakdownRowPair` null branch (`breakdown-rows.ts:10-13`)                                                            | rate only                                                         | null → `faceValue(row.recordedGross)`. Null already means „no effective rate" in both modes, so no mode is needed.                                                                                    |
| 4   | `materialTransactions[].billed` → manager `sumBilled` (`investment-transactions.ts:85-89`, `expense-datasets.ts:45`)  | no                                                                | Decide: rate-aware footer, or accept (Open Question 2).                                                                                                                                               |
| 5   | Sheet sync `tab-rows.ts:56`                                                                                           | no                                                                | Decide (Open Question 3).                                                                                                                                                                             |

**Candidate seams:**

- **A (recommended): the rule in `deriveFinancials`**, plus #3 in the renderer. One row-level
  pick. `InvestmentFinancialsT` keeps its shape: `materialsNetBilled` changes value, not type.
  - The `billedMaterials` / `computeAmountDue` readers follow automatically: they add `netBilled`
    at face value.
  - The listing (`shape-investments.ts:45,59`), v1 `calculateBalance` and the v2 panel all read
    that field.
  - Downsides: #2, #4 and #5 still need their own handling. The cache payloads keep their shape
    but hold stale values until a tag fires; the `investments` tag fires on every mode or rate
    change (`actions/kosztorys.ts:167`), so `investment-financials-v2` and
    `preview-kosztorys-editor-data-v2` self-heal. Bumping the key is still cheap insurance.
- **B: a mode-aware `billedAmountFor(type, amount, netAmount, effectiveRate)`.** A single row-level
  definition, but every caller then needs the investment's rate: the cached
  `deriveCategoryBreakdowns`, `investment-transactions` and `tab-rows`. That means cache key or tag
  changes.
- **C: carry both sums (`materialsNetBilledGross` on `MaterialsT`) and pick at each reader.** This
  follows lesson :554 („SQL returns both, TS picks"), but spreads the pick across
  `billedMaterials`, `computeAmountDue`, `breakdownRowPair` and `calculateBalance`. It widens cached
  payloads, so the keys must be bumped. It adds more drift points than A.

### 5. Hosts and caches

- **Investment page (v1 tiles + `InvestmentSummaryPanel`):**
  - `inwestycje/[id]/page.tsx:58` calls `deriveFinancials(..., investment.settlementMode)`.
  - The panel goes through `deriveWholeInvestmentFinancials`.
  - Caches: `investment-financials-v2` (`balances.ts:52-68`, tags transfers + investments) and
    `category-breakdowns-v2` (`transfer-totals.ts`, tag transfers).
- **Editor `kosztorys_v2`:** the same `deriveWholeInvestmentFinancials`. A mode or rate change runs
  `updateInvestmentSettlementModeAction`, which expires `investments`.
- **Investor `/k/[token]`, `/podglad-inwestora/[id]`:** `preview-kosztorys.ts` caches the derived
  financials, `materialsBreakdown` and `materialTransactions[].billed` under
  `preview-kosztorys-editor-data-v2` (tags investments + transfers).

### 6. Data (local dump 2026-09-23, read-only)

- **The only wydatek netto** is id 5328, inv. 146 „Inna Chorna Postępu 4a":
  - 4809,60 / 4453,33 (8,00%), unsettled, „Materiały wykończeniowe";
  - tryb NET, `materials_net_rate` null, `vat_rate` 0.08.
- **Tryb per investment:** NET 137, GROSS 1 (inv. 19, completed, no wydatek netto), MIXED 1
  (inv. 137, test).
- **Materiały rate** is set only on 137 (0.08), 124 (0.08) and 115 (0.23).
- The 2026-09-23 research said inv. 146 had a 23% rate. Locally it is null; the staging manual
  checks set 23% by hand.

### 7. Tests

**Turn red (they pin netto-at-netto with no rate):**

- `src/__tests__/lib/kosztorys/breakdown-rows.test.ts:67-72`
- `src/__tests__/components/kosztorys/summary/tables/materials-breakdown-table.test.tsx:74-80`
- `src/__tests__/lib/kosztorys/summary-economics.test.ts:67-70`: only if the pick lands in
  `billedMaterials`. Under seam A it stays green: the input changes, not the function.
- `src/__tests__/lib/queries/shape-investments.test.ts:151-177` („leaves the saved rate inert under
  rozliczenie brutto"), if its fixture gains a netto row.
- `derive-financials-bucketing.test.ts`, `lib/db/investment-financials.test.ts`: new cases for the
  pick.

**Blind today:**

- `e2e/client-share.spec.ts:233-284` asserts only list Razem 3690, never the breakdown Razem or
  „Materiały". Those are 3460 today and 3690 under the rule.
- The golden master (`financial-golden-master-db.test.ts`) does not move: its dump has no no-rate
  wydatek netto other than inv. 146. Check whether 146 is in the compared set.

**Fixture trap.** These pairs are exactly 23% apart, so a wrong implementation
(`toGross(net, vatRate 0.23)`) passes them:

- `seed-client-share.ts:123` (1230/1000)
- `materials-transactions-table.test.tsx:21-28`
- `derive-financials-bucketing.test.ts:352-360`
- `seed-materials-net.ts:52-66`

Use the real 8% pair, 4453,33 / 4809,60, already in `breakdown-rows.test.ts` and
`materials-breakdown-table.test.tsx`.

**Missing cross-seam assertion:** list Razem = breakdown Kwota/Brutto Razem = „Materiały". It
belongs in a DOM spec over `SummaryExpensesTab` + overview with the 8% fixture, or in
`client-share.spec.ts`.

## Code References

- `src/lib/kosztorys/settlement-mode.ts:67-72`: `effectiveMaterialsNetRate`, GROSS → null.
- `src/lib/db/investment-financials.ts:79-105`: `deriveFinancials`, the recommended home; already
  has the rate and the mode.
- `src/lib/db/investment-financials.ts:37-66`: `deriveCategoryBreakdowns`, mode-free and cached.
- `src/lib/queries/investment-financial-fields.ts:22-25, 36-74`: `buildMaterialsBreakdown`, the
  uncategorised remainder.
- `src/lib/kosztorys/breakdown-rows.ts:10-13`: null-rate branch of `breakdownRowPair`.
- `src/lib/kosztorys/summary-economics.ts:44-62, 84-111`: `billedMaterials`, `combinedPair`,
  `computeAmountDue`.
- `src/lib/queries/investment-transactions.ts:85-89`: per-row `billed`.
- `src/lib/kosztorys/expense-datasets.ts:45-53`: `sumBilled` / `sumAmount`, and the „never
  reconciled" comment at :49-50.
- `src/lib/google/tab-rows.ts:56`: sheet sync billed.
- `src/components/kosztorys/summary/materials-pricing-options.ts:14,22`: the UI copy that already
  promises brutto.
- `src/lib/queries/shape-investments.ts:45,59`: listing wydatki and bilans.
- `src/lib/db/calculate-balance.ts`: v1 bilans via `totalMaterialCosts`.

## Architecture Insights

- **Strategy by pricing plane.** A row's `origin` picks its pricing (`breakdownRowPair`). The new
  rule adds a second axis, the effective rate. For a netto row:
  - with a rate: `{net: N, gross: A}`;
  - without: `faceValue(A)`.

  Everything downstream only sums priced pairs.

- **One pick, upstream of the readers.** Lesson :554 says SQL carries both sums and TS picks. The
  question is only where the pick lives. `deriveFinancials` is the one place that already sees the
  investment-level facts (rate and mode). That matches lesson :615: the mode is a fact of the
  entity, so apply it server-side, once.
- **Two meanings of „rozliczenie brutto".** One is the robocizna tryb, the other the materiały
  select. They collapse into one predicate, „effective rate == null". Naming that predicate
  explicitly would stop the next change keying on `mode === 'GROSS'` by mistake.

## Historical Context (from prior changes)

**Rulings the change reverses:**

- `context/archive/2026-07-29-netto-expense-grossup/review-gate.md:26` (2026-08-07): „the materiały
  rate is the ONLY thing that crosses a netto-billed wydatek — no rate, no crossing, on either
  axis". This is where no-rate / GROSS was actually decided: netto at face value.
- `0ec91492^:context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/research.md:224-226` (Q1): no rate →
  „Kwota" shows the netto, „so Razem still equals Materiały".
- `0ec91492^:context/changes/2026-09-23-materialy-inwestora-brutto/research.md:25-27, 219-228` (Q3 = A):
  - the list Razem ≥ Materiały, in the investor's favour, never reconciled;
  - option B („brutto breakdown") was rated „Worst" because it broke the tie to Podsumowanie. The
    new rule avoids that objection by moving Podsumowanie **with** the breakdown.
- `context/reference/kosztorys-editor-domain-notes.md:536-541, 551-557`: „Bez stawki … pokazuje
  netto", „Zmiana jest tylko w wyświetlaniu", „Tych dwóch sum się nie uzgadnia". All must be
  rewritten.

**Rulings it builds on:**

- `context/archive/2026-07-24-netto-expense-type/change.md:34-39`: stored figures beat derived
  ones. Hence `amount`, not netto × rate.
- `context/archive/2026-07-26-materials-net-pricing-persisted/change.md:116-122`: at rozliczenie
  brutto „VAT is added on top"; the client pays the amount entered.
- `context/reference/kosztorys-editor-domain-notes.md:1045` (2026-08-23): „przy rozliczeniu brutto
  materiały wchodzą stawką ze sklepu".
- `context/archive/2026-08-20-mixed-settlement-both-planes/change.md:134-139`: materiały at face
  value on both planes. The rule keeps this: A at face value.

**The earlier near-miss.** `context/archive/2026-07-29-netto-expense-grossup/change.md:40-43`: the
plan first grossed netto up only when `settlementMode === 'GROSS'`. The owner changed it to „always,
one rate" during implementation, and it was later reverted by the 2026-08-07 ruling.

**Manual checks.** `context/foundation/manual-checks.md:1036-1040, 1084-1093` record today's
behaviour as passing:

- no rate → netto row 4453,33 / 1000,00, Razem = Materiały;
- investor list 1730 = Σ brutto.

These checks become obsolete.

**Linear:** EX-536, EX-567 (netto type); EX-576 (owed netto E2E); EX-595 (settled materiał netto
rate source); EX-668 (materiały-netto fixture).

## Related Research

- `context/reference/kosztorys-editor-domain-notes.md` — „Widok inwestora zakładki „Materiały"", destylat obu poniższych
- `0ec91492^:context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/research.md` (skasowany przy archiwizacji — `git show`)
- `0ec91492^:context/changes/2026-09-23-materialy-inwestora-brutto/research.md` (skasowany przy archiwizacji — `git show`)

## Open Questions

1. **Trigger.** Materiały select „Brutto" (no rate), which also covers tryb GROSS. Recommended; a
   GROSS-only rule misses inv. 146. Confirm.
2. **Manager view with no rate.** The unmerged „… netto" row and Razem move to the invoice brutto.
   Should the „Materiały rozliczane netto" list tab footer then total the brutto too, so the
   manager's two footers still add up to Razem? Recommended: yes, or hide the tab split when no
   rate is in effect.
3. **Owner's sheet („transfery" tab).** The sync writes the netto as the billed amount for every
   wydatek netto, regardless of the investment's materiały mode. Should it follow? It would need the
   investment's rate at sync time.
4. **Money.** Inv. 146 bills +356,27 zł more (Pozostało do zapłaty, bilans on the listing). Confirm
   this is intended now that „Materiały" rises together with the list.
5. **With a rate set:** unchanged. The list equals the breakdown's Brutto Razem, and „Materiały" is
   the Netto. Add the missing test that pins list Razem = Brutto Razem.
