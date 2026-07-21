---
date: 2026-07-21T00:00:00+02:00
researcher: ex-Plant
git_commit: 090712dc3790ac929e6bc98adddd4124f3579189
branch: konradantonik/ex-536-kosztorys-zaliczka-netto-brutto
repository: wykonczymy
topic: 'Deposit (wpłata) transactions carry both netto and brutto; drop the stage link; differentiate wpłaty netto/brutto in Podsumowanie'
tags: [research, codebase, transfers, deposits, vat, kosztorys, podsumowanie]
status: complete
last_updated: 2026-07-21
last_updated_by: ex-Plant
---

# Research: deposit netto/brutto + drop stage link + differentiated wpłaty in Podsumowanie (EX-536)

**Date**: 2026-07-21 (Europe/Warsaw)
**Researcher**: ex-Plant
**Git Commit**: 090712dc3790ac929e6bc98adddd4124f3579189
**Branch**: konradantonik/ex-536-kosztorys-zaliczka-netto-brutto
**Repository**: wykonczymy

## Research Question

EX-536: a deposit (wpłata) transaction must carry **both netto and brutto**. Owner constraints added this turn:

1. „Zaliczka" is misleading — the concept is **„wpłata"** (payment), not specifically an advance. Rename in UI.
2. **Drop the stage link** — the deposit→etap bridge (`kosztorysStage`) is removed; wpłaty are not per-etap.
3. **Podsumowanie shows wpłaty differentiated** — „wpłaty netto" and „wpłaty brutto" as two figures, not one.

The storage mechanic (store both axes / one amount + a plane flag / derive one from the other) is **undecided — owner will decide**. This research grounds that decision in code; it does **not** pick the mechanic.

## Summary

- Today a transaction has **one `amount`**, no netto/brutto, no VAT field. The only VAT in the system is **per-investment** (`investments.vat_rate`, default 0.08) and it is consumed **only** by the kosztorys client-price plane — transfers never touch it.
- Every „wpłaty" figure in the app is a single face-value number: `deriveFinancials().totalIncome` (`investment-financials.ts:43`). The kosztorys Podsumowanie already renders wpłaty through the net/gross pair shape but **forces `gross === net`** via `faceValue()` + a `noBrutto` render flag. Differentiating the two axes means the deposit sum must become a **real pair at the source**.
- The repo already has the exact pattern the new pair should adopt: **`MoneyPairT` / `moneyPair()` / `faceValue()`** in `summary-economics.ts:3-16`. This is a source-of-figures change, not a new rendering primitive.
- The stage link (`kosztorysStage`) removal is a **contained but multi-file** operation: a runtime-breaking SQL column drop plus a dead-code sweep across form → schema → action → validate-hook → the whole `fetchZaliczkiByStage` read chain that surfaces the per-etap „Wpłaty" row in `kosztorys-etap-totals.tsx`. That per-etap row is the **only** feature lost.
- **Warning:** `kosztorys-editor-body.tsx` has uncommitted local edits on this branch (the hydration-gate work riding along) — the stage-link prop removal there will collide; coordinate.

## Detailed Findings

### 1. The deposit write path today (single `amount`)

- **Form**: `src/components/forms/deposit-form/deposit-form.tsx` (`FORM_ID='deposit'`). Reuses the **expense** form schema (`expenseFormSchema`, `expense-form/expense-schema.ts:17-37`). Single amount input via `form-fields/amount-field.tsx:9-23` („Kwota (PLN)"). `paymentMethod` is **not** a field — hardcoded `'CASH'` (only CASH enabled in `PAYMENT_METHODS`, `transfers.ts:124-129`). No invoice inputs in the deposit form (invoice upload lives only in the expense flow).
- **Server schema**: `src/lib/schemas/transfer.ts:14-39` — `createTransferSchema`, `amount: z.number()` (line 17), refined by `getAmountError` (`validation.ts:7-12`: deposits must be `> 0`).
- **Server action**: `src/lib/actions/transfers.ts:30-80` — `createTransferAction` → `validateAction` → register/stage checks → `payload.create({ collection:'transactions', data:{ ...data } })`. `amount` flows through unchanged as one number.
- **Collection**: `src/collections/transfers.ts:82-93` — one `amount` number, **create-only** (`access.update:()=>false`). „Invoice documentation" section (`:200-217`) = `invoice` (media) + `invoiceNote`; **no** `vat`/`net`/`gross` fields anywhere on a transaction.
- **Predicates**: `src/lib/constants/transfer-rules.ts` — `isDepositType` = membership in `DEPOSIT_TYPES = ['INVESTOR_DEPOSIT','COMPANY_FUNDING','OTHER_DEPOSIT']`. Deposits: `needsSourceRegister` true (register is the _receiving_ one), `showsInvestment` true, `requiresInvestment` only for `INVESTOR_DEPOSIT`, `canBeSettled` **false**.
  - **Gotcha**: predicates read membership arrays **lazily** because of the `transfers.ts ↔ transfer-rules.ts` re-export cycle (`transfer-rules.ts:10-13`; `lessons.md` cycle note). A new netto/brutto predicate must follow the same lazy pattern.
  - **React Compiler gotcha** (`lessons.md:79-80`): the deposit form's store hooks are recognized as hooks only by `use*` naming; any form-field extraction must keep the `use*` call-site convention or the hook order breaks.

### 2. Only VAT source in the system

- `src/collections/investments.ts:98-105` — `vatRate` (fraction, default `DEFAULT_VAT = 0.08`, `kosztorys/constants.ts:11`), migration `20260710_0_add_vat_rate_to_investments.ts`.
- Consumed exclusively by the kosztorys client-price plane (`money-axis.ts`, `calc.ts:63` `toGross`). **Transfers do not read `vatRate` anywhere today.** A deposit that grosses via VAT would be the first transfer to consume it.

### 3. Where „wpłaty" is summed (single figure) and the pair pattern to adopt

- **The one sum**: `src/lib/db/investment-financials.ts:43` — `totalIncome = sumRows(rows, r => DEPOSIT_TYPES.includes(r.type))`. Every wpłaty figure in the app is this single face-value number.
- **Do zapłaty R+M**: `src/lib/kosztorys/summary-economics.ts:67-78` — `computeDoZaplatyRM(laborCostsNetFromKosztorys, wplatyNet, materialyNet, vatRate)`: `net = R − wpłaty + M`; `gross = toGross(R) − wpłaty + M`. **Wpłaty enters both planes at the same face value today** (`:74-76` comment states this deliberately).
- **The pair pattern** (canonical, `summary-economics.ts:3-16`):
  ```ts
  type MoneyPairT = { net: number; gross: number }
  moneyPair(net, vatRate) // prace plane: gross = toGross(net, vatRate)
  faceValue(net) // no-VAT plane: gross === net
  ```
  Wpłaty is currently `faceValue(wplatyNet)` (`kosztorys-summary.tsx:128`) — one number wearing the pair shape with `gross===net`, and the UI hides the brutto cell via **`noBrutto`** (`summary-grid.tsx:50`; row at `kosztorys-summary.tsx:191-204`).
- **Consequence**: to differentiate, `totalIncome` must become a real `{net, gross}` pair at the source. Then `computeDoZaplatyRM` consumes `wplaty.net`/`wplaty.gross` separately (brutto Do zapłaty subtracts brutto wpłaty), and the wpłaty row drops `noBrutto`.

### 4. Investment-view render of wpłaty

- `src/lib/db/map-category-costs.ts:78` — `{ label:'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome }`.
- `src/components/investments/financial-stats.tsx:17,95-100` — `INCOME_LABEL='Wpłaty'` green income row; consumed by `inwestycje/[id]/page.tsx` and `raporty/page.tsx`.
- Balance: `calculate-balance.ts:8` — `totalIncome − costs + rabat`.

### 5. Stage-link removal blast radius (`kosztorysStage`)

Origin: `src/collections/transfers.ts:152-163` (relationship „Zaliczka na etap"), column added by `src/migrations/20260718_1_add_kosztorys_stage_to_transactions.ts`.

**Runtime-breaking (must land with the column drop):**

- `src/lib/db/sum-transfers.ts:256-275` — `sumDepositRowsForInvestment` selects `kosztorys_stage_id`; SQL errors once the column is gone.
- The full read chain up to the UI: `zaliczki.ts` (`sumZaliczkiByStage`) → `queries/reference-data.ts:250-263` (`fetchZaliczkiByStage`) → `kosztorys_v2/page.tsx` + `queries/client-kosztorys.ts` fetch → `kosztorys/types.ts:124` (`zaliczkiByStage`) → editor prop pass-through (`kosztorys-editor-v2.tsx`, `kosztorys-editor-body.tsx`, `kosztorys-totals-panel.tsx`) → **`kosztorys-etap-totals.tsx:25-30,47,58-61,128-142`** — the per-etap „Wpłaty" row (tagged zaliczki columns + „Bez etapu" remainder).

**Dead code to strip:**

- Deposit form stage Select + `NO_STAGE` sentinel + reset listeners (`deposit-form.tsx:45-47,72,86-88,96,108,138,144-146`).
- `transfer.ts:29` (`kosztorysStage` in schema), `transfer-validation.ts:23,67-69` (deposit-only gate), `transfers.ts` action stage-membership check (`:47-62`), `validate.ts:108-129` (null-on-non-deposit + orphan-clear), `reference-data` `kosztorysStagesByInvestment` plumbing (`types/reference-data.ts:58-59`, `queries/reference-data.ts:93,150-186`).
- `zaliczki.ts` (whole file), `fetchZaliczkiByStage`.

**Tests to delete:** `transfer-schema.test.ts:446-472`, `validate-hook.test.ts:153-209`, `hooks/orphaned-etap-tag.db.test.ts` (whole), `lib/kosztorys/zaliczki.test.ts` (whole). Trim `kosztorysStagesByInvestment:{}` stubs in `default-cash-register/dashboard-aggregation/transfer-table` tests only if the field leaves `ReferenceDataT`. **Keep** `summary-economics.test.ts:52-62` (tests total-wpłaty math, unaffected).

**Untouched:** `kosztorys_stages` table/collection (that's the stages themselves), `settlement.ts`/`calc.ts`/`summary-economics.ts` (use only total `wplatyNet`, no per-stage dependence), `CACHE_TAGS.kosztorysStages` (still used by stage CRUD).

**Product decision inside the removal**: `kosztorys-etap-totals.tsx`'s „Wpłaty" row is the only surface of the tag. After removal — drop the whole row, or keep a single total-Wpłaty figure (which comes from `wplatyNet`, not the tag)?

**Prior art (`lessons.md:189-190`)**: EX-547 (a `kosztorysStage` cross-investment validation gap) was closed as a **non-defect** — the read path scopes by `investment_id`, so a foreign tag falls into „Bez etapu" harmlessly. Removing the tag entirely dissolves that whole class.

### 6. The rename (zaliczka → wpłata)

Mostly already done in code: the type is `INVESTOR_DEPOSIT` / `deposit`, and the Polish UI label is already „Wpłata od inwestora" (`transfers.ts:18`). The „zaliczka" wording survives in the **stage-link label** „Zaliczka na etap" (`transfers.ts:159`) — which is being deleted anyway — and in the per-etap „Wpłaty"/zaliczki row. So the rename is largely **discharged by the stage-link removal**; verify no user-facing „zaliczka" string remains after (grep `zaliczk` in `src/components/**`, `src/collections/**`).

## Code References

- `src/collections/transfers.ts:82-93` — the single immutable `amount` field
- `src/collections/transfers.ts:152-163` — `kosztorysStage` (to remove)
- `src/lib/db/investment-financials.ts:43` — `totalIncome`, the one wpłaty sum
- `src/lib/kosztorys/summary-economics.ts:3-16` — `MoneyPairT` / `moneyPair` / `faceValue` (the pair pattern)
- `src/lib/kosztorys/summary-economics.ts:67-78` — `computeDoZaplatyRM` (wpłaty into both planes at face value)
- `src/components/kosztorys/kosztorys-summary.tsx:128,191-204` — wpłaty row, `faceValue` + `noBrutto`
- `src/components/kosztorys/kosztorys-etap-totals.tsx:25-142` — the per-etap „Wpłaty" row (only stage-tag surface)
- `src/lib/db/sum-transfers.ts:256-275` — `sumDepositRowsForInvestment` (runtime-breaks on column drop)
- `src/lib/constants/transfer-rules.ts` — deposit predicates + lazy-read cycle note
- `src/collections/investments.ts:98-105` — `vatRate` (the only VAT source)

## Architecture Insights

- **Two-plane VAT doctrine** (`domain-notes.md:280-306`): VAT is a property of the **client-price plane (prace)** only; the księga/actuals plane is netto face-value. EX-536 makes **wpłata the one exception** — the domain notes already record the decision (`:291-296`) and explicitly leave the mechanic open. This is a deliberate carve-out, so the implementation should make the exception legible (a wpłata that carries gross must be visibly distinct from a face-value transfer).
- **The figure lives in `lib/db`/`lib/kosztorys`, not the component**: differentiating wpłaty is a change to `deriveFinancials` (make `totalIncome` a pair) that ripples up; the render layer already has the `noBrutto`/pair machinery.
- **`amount` immutability**: today create-only. A net/gross pair inherits that decision — edit flow (`updateTransferSchema`) currently allows amount edits only via the positive-only rule; a pair needs the same treatment.

## The mechanic — DECIDED (owner, 2026-07-21)

**A boolean flag on the transaction, nothing more.** The transaction stores **only the amount + a boolean** „czy wpłata była netto czy brutto". **No computation happens in the transaction** — it records the raw amount and which plane that amount is on. **The arkusz (Podsumowanie) does all the math**, per the two-plane doctrine (the figure lives in `lib/db`/`lib/kosztorys`, never in the transfer):

- flag = **netto** → the second axis (brutto) **adds** VAT: `brutto = amount × (1 + vat)` (`toGross`, `calc.ts:63`).
- flag = **brutto** → the second axis (netto) **strips** VAT: `netto = amount ÷ (1 + vat)`.

**Math confirmed** (owner): for vat = 0.08, `netto = brutto ÷ 1.08`. This is a **division by (1+vat), not a ×(1−vat)** — `100 ÷ 1.08 = 92.59`, whereas `100 × 0.92 = 92.00`. Introduce a `toNet(gross, vat) = gross / (1 + vat)` helper as the inverse of `toGross`; don't approximate.

This is essentially the old option **B**, but simpler than framed: no per-row `NET`/`GROSS` enum machinery — just a boolean. The "single wpłata split cash+invoice" case (old A) is **not** modelled; a split is two transactions. Owner did not need it.

**Additional requirement — colour-coding.** In the arkusz, colour the transaction amount to distinguish **what is computed** (the derived second axis) from **what comes directly from the transaction**. A brutto-flagged wpłata shows its brutto figure as source and its netto as derived (and vice versa); the colour makes „przeliczone vs. wprost z transakcji" legible at a glance.

**Legacy data — accepted rozjazd (owner).** Existing deposit rows are real prod data and have **no flag** (the decision was made now). We accept a **discrepancy** on historical wpłaty rather than backfill — record it, don't fix it. New column is nullable / defaults to a documented plane; old rows keep their single `amount` on whatever plane they were entered, and the summary may be slightly off for pre-decision deposits. This is a **deliberate, documented** rozjazd, not a bug.

## Resolved by owner (2026-07-21, round 2)

- **Legacy rows (no flag) — RESOLVED.** Render the raw `amount` into **both** columns (netto = brutto = amount, no VAT math — exactly today's face-value behaviour), tagged with a distinct **„legacy" colour**. This bounds and _shows_ the rozjazd instead of guessing a plane. No default-plane needed; legacy is its own visual state.
- **Per-etap „Wpłaty" row — RESOLVED (replace, don't just drop).** Remove the per-etap / „Bez etapu" split entirely. Replace with a **flat list of all wpłaty for the investment**: date + amount (+ netto/brutto axis + colour) + **a link to each transaction**. This is a new small surface, not merely deletion of the old row.
- **Colour-coding — clarified.** Per wpłata, one axis is **source** (what the owner typed) and the other is **derived** (computed by the arkusz). Colour marks source vs. przeliczone so the two numbers aren't confused. Three visual states total: **source**, **przeliczone (derived)**, **legacy**. Which exact element + which theme token = plan detail.

### Scope of the flag — RESOLVED (owner, 2026-07-21)

The netto/brutto flag lands on **`INVESTOR_DEPOSIT` (Wpłata od inwestora) ONLY** — the only active deposit type (226 rows, ongoing to 2026-07-18). `COMPANY_FUNDING` (26 rows, dead since April) and `OTHER_DEPOSIT` (13 rows, dead since April) stay **nominal/legacy** — no flag. Their possible outright removal is parked: **EX-557** (label `parked`). So the flag column/UI condition is gated on `INVESTOR_DEPOSIT`, not `isDepositType`.

## Open Questions (for planning)

1. **Colour tokens** — which `--color-*` theme tokens for source / przeliczone / legacy, and exactly which cells in the wpłaty list + summary carry them.

## Historical Context (from prior changes)

- `context/reference/kosztorys-editor-domain-notes.md:280-320` — the two-plane VAT doctrine + the EX-536 wpłata exception (mechanic left open) + the dissolved RABAT-transaction axis (EX-539).
- `context/changes/robocizna-from-kosztorys/open-questions.md` — Q1 (this change's origin, answer „OBIE") and Q2 (RABAT dissolved). EX-536 unblocks EX-535.
- `context/foundation/lessons.md:189-190` — EX-547 `kosztorysStage` non-defect (read path scopes by investment); the tag's removal dissolves that class.
- `context/foundation/lessons.md:79-80` — React Compiler hook-naming gotcha in the deposit form; `:154-155` — editor `useState`-init-at-mount staleness for denormalized per-row fields (relevant if a per-row VAT/gross field is added).

## Related Research

- `context/changes/kosztorys-summary-charts/change.md` — adjacent Podsumowanie work (pies), same footer panel this change touches.
