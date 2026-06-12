# Kosztorysy / Investments — Client Notes → TODO

> **Status (2026-06-12).** Most of this list shipped. The remaining open items (3b/3c/3d)
> push _more_ into Google Sheets — which the off-sheets arc (`context/foundation/roadmap.md`)
> is retiring. Re-confirm with the client whether they're still wanted before planning, or
> let the in-app kosztorys (workstream B) supersede them. The canonical todo is the roadmap.

## Checklist

- [ ] **1. Materiały R+M** — in progress; owned by `docs/plan-settled-expenses.md` (`settled` flag). Not tracked here anymore.
- [x] **2. Rabat** — shipped (`investment-rabat`).
- [x] **3a. Zaliczki/wpłaty → Sheet** — shipped.
- [ ] **3b. Wypłaty → Sheet** — open; hidden table, excluded from client copy. ⚠ may be superseded by off-sheets.
- [ ] **3c. BUG: materiały sum stuck on B1** — open; investigate cell binding (likely a formula in the client's template, not an app bug — see §3c below).
- [ ] **3d. Podsumowanie wydatków** — open; auto-maintain in Sheet. ⚠ may be superseded by off-sheets.
- [x] **4. Pulpit na osobne strony** — shipped (`feat/dashboard-split`).

---

Source: raw client conversation in `docs/notes`. Nothing dropped — every point below traces to a line in that file. Polish domain terms kept verbatim; analysis in English.

**Overarching goal (context, lines 35–37):** kill the double data-entry. Today Adrian keys everything into both the app **and** the client's Excel/Sheet → constant mess and reconciliation pain. The endgame is full automation so the client-facing Sheet is driven by the app and Excel goes away. They started with **materiały** because the client said that's the biggest pain right now. Each item below is a step toward that.

---

## 1. Materiały jako składowa robocizny — "R+M" (affects marża)

**Client lines 1–2, 8–13. Highest-value item.**

### Problem

More and more investments are billed as **robocizna z materiałem (R+M)** — one labor-incl-material price, regardless of what the materials actually cost. Example from the call: material cost 90 zł, but the client was billed a single R+M labor figure. That 90 zł is **the company's own cost** and should **reduce marża** — but it doesn't today.

### How it maps to the app

- `marża` today = `LABOR_COST − PAYOUT` only. Materials are **not** in the formula. → `src/lib/calculate-margin.ts:1-6`, used at `src/lib/queries/investments.ts:43`.
- Regular materials go in as `INVESTMENT_EXPENSE`. Those hit `saldo` (`totalMaterialCosts`) → they are billed **extra to the client**. → `src/lib/db/sum-transfers.ts:155-166`, `src/lib/calculate-balance.ts:1-8`.
- So neither existing path fits R+M: `INVESTMENT_EXPENSE` bills the client extra (wrong — client already paid R+M), and `LABOR_COST` is "what someone is paid" (wrong meaning). Client explicitly rejected both (lines 10, 13).

### What the client actually wants (lines 13)

A distinct expense kind — call it **"materiały budowlane niepodlegające rozliczeniu"** (building materials not subject to client settlement / R+M materials) that:

- [ ] **Decrements the cash register** (it's a real spend — "musi się to odjąć z kasy"). NB: must be a **positive expense that subtracts**, not a negative amount — client warned a minus would _add_ to the register instead of subtracting (line 13).
- [ ] Is **linked to the investment** and shows up as an **investment cost** ("wyświetla się jako inwestycyjny wydatek / koszty").
- [ ] Does **NOT** add to the client's bill / `bilans` (client must not pay extra for it — "klient ma za to nie płacić dodatkowo").
- [ ] **DOES reduce marża** — the whole point. Target display: `robocizna − (te materiały) = marża`, materials shown **next to** labor (line 13).
- [ ] Stays **cleanly separate** from normal materiały so data doesn't get dirty (client got burned reconciling mixed investments — line 13).

### Tasks

- [ ] Decide mechanism: new transfer `type` (e.g. `RM_MATERIAL` / "Materiały R+M niepodlegające rozliczeniu") vs. a flag on `INVESTMENT_EXPENSE`. New type is cleaner given the "keep separate" requirement and the margin/balance routing differences. Touch `src/collections/transfers.ts:7-21`, `src/lib/constants/transfers.ts`.
- [ ] Update `calculateMargin` to subtract this new bucket → `src/lib/calculate-margin.ts`, `src/lib/db/sum-transfers.ts:148-204` (add a `total_rm_materials` aggregate).
- [ ] Ensure it is **excluded** from `totalMaterialCosts`/`totalIncome` so it does NOT change client-billable `saldo`/`bilans` → `calculate-balance.ts`, `sum-transfers.ts`.
- [ ] Ensure register balance recalculation treats it as an outflow → `src/hooks/transfers/recalculate-balances.ts`.
- [ ] UI: surface the new "materiały" cost column beside robocizna in the investment financials view.

---

3

## 2. Dodanie pozycji jako rabat (discount that affects marża)

**Client lines 1, 18–25.**

### Problem

Grojecka example: client mis-invoiced, 800 zł leftover, negative saldo. He logged it as **korekta**. But **korekta only moves saldo, not marża** — and a discount given off labor _should_ hit marża. He needs a real **rabat**: a discount taken off **robocizna**, which **is the company's cost**, so it **reduces marża**. (His math on the call: `9547 − 3900 = 5647`.)

### How it maps to the app

- `CORRECTION` ("Korekta") must be **negative**, counts into `total_costs`/`total_corrections` → reduces material side of `saldo`, **does not touch marża**. → `src/lib/validation-utils.ts:7-11`, `src/lib/db/sum-transfers.ts:157-158`.
- There is **no `RABAT` concept today** (confirmed). The only discount-ish path is negative `CORRECTION`, which is exactly the one that _doesn't_ affect marża.

### Tasks

- [ ] Add a **`RABAT`** transfer type ("Rabat") = discount off robocizna, treated as a company cost that **reduces marża** (same side as PAYOUT in the margin formula, or as a negative labor adjustment). Touch `src/collections/transfers.ts`, `src/lib/constants/transfers.ts`, `src/lib/calculate-margin.ts`, `src/lib/db/sum-transfers.ts`.
- [ ] Decide its effect on `saldo` (client says rabat is a cost to him; confirm whether it should also reduce what the client owes). Keep distinct from `korekta` semantics.
- [ ] Validation rule (sign) in `src/lib/validation-utils.ts`.
- [ ] Expose in the transfer/expense form so it can be entered per investment.

---

## 3. Automatyczna aktualizacja kosztorysów (deposits, payouts, advances, expense summary)

**Client line 3, 30–31, 35–37.**

### Problem

Only **investment expenses** currently flow into the linked Google Sheet. Everything else (zaliczki/wpłaty, wypłaty, summary) is keyed twice. Client wants these to auto-populate the Sheet like the locked expenses block already does.

### How it maps to the app

- Today **only `INVESTMENT_EXPENSE`** syncs to the Sheet (tab `"wydatki inwestycyjne (tylko do odczytu)"`). Deposits and payouts are explicitly skipped. → `src/hooks/transfers/sync-sheet.ts:30`, `src/lib/actions/sheets-sync.ts:103-127`, `src/lib/google/sheets.ts:21`.
- No netto/brutto/VAT anywhere — deposit form & transfers schema have only a flat `amount`. → `src/components/forms/deposit-form/deposit-form.tsx`, `src/collections/transfers.ts:73-248`.

### 3b. Wypłaty (payouts) → hidden Sheet table

- [ ] Sync `PAYOUT` rows into a **hidden** table in the Sheet — must **not** appear in the client-facing copy (lines 35–37). Same sync infra as 3a, plus a hide/strip step for the client export.

### 3d. Podsumowanie wydatków (expense summary) — auto

- [ ] Auto-maintain the expense summary in the Sheet so it isn't re-keyed (line 3). Likely falls out of 3a–3c once deposit/expense/payout blocks all sync.

> Sequencing note (lines 37): client knows this is "parę dni roboty"; the agreed order is **materiały first** (items 1 + 3c), then the rest of automation. Each block can ship independently.

---

## 4. Pulpit — sekcje na osobne strony ✅ DONE

**Client line 4.**

### Problem

The dashboard crammed Kasy, Inwestycje and Transakcje onto one `/` page. The point was to give each its **own page** instead of stacked sections.

### What was done (`feat/dashboard-split`)

- `fetchManagerDashboardData()` decomposed into focused fetchers (`fetchVisibleRegisters`, `fetchAllInvestments`) → `src/lib/queries/cash-registers.ts`, `src/lib/queries/investments.ts`.
- New pages `src/app/(frontend)/kasy/page.tsx` and `src/app/(frontend)/inwestycje/page.tsx`; `CashRegistersTable` extracted to its own file; grab-bag `dashboard-tables.tsx` deleted.
- `/` slimmed to Saldo + Ostatnie transakcje; sidebar links point at the dedicated routes (`SECTION_LINKS` → `/`, `/kasy`, `/inwestycje`).

---

## Open questions to confirm with client

1. **Item 2 (rabat):** does rabat also reduce the client's `saldo`/what they owe, or affect **marża only**? He framed it as his own cost — needs one explicit answer.
2. **Item 1 (R+M materials):** confirm display — "materiały R+M next to robocizna, `robocizna − materiały = marża`". And confirm it must show under investment **koszty** but never bill the client.
3. **Item 3c:** is the "B1" thing a manual formula in his Sheet template, or did he expect an app binding feature? Determines whether this is a bug fix or a new config feature.
