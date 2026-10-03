---
date: 2026-10-02T10:12:15+02:00
researcher: Claude Opus 5.5
git_commit: 2f4dab09c1e3445adb753845ed81426f0815fba5
branch: staging
repository: wykonczymy
topic: "Remove the no-kosztorys „brak danych" gate on the investments listing's v2 columns"
tags: [research, investments-listing, kosztorys, v2-columns, subcontractor-remaining, worker-payout-pairs]
status: complete
last_updated: 2026-10-02
last_updated_by: Claude Opus 5.5
---

# Research: Remove the no-kosztorys „brak danych" gate on the investments listing

**Date**: 2026-10-02T10:12:15+02:00
**Researcher**: Claude Opus 5.5
**Git Commit**: 2f4dab09
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Owner ruling 2026-10-02: an investment with no kosztorys (no work hours — „Kijowska 17 dwa mieszkania
materiały", settled on materials only) is legitimate and must show real figures on the listing, not
„brak danych". Where does the gate live, what else depends on it, what does it change on prod data?

## Summary

- The gate is **display-only** and lives in one file: `src/components/tables/investments.tsx`
  (`hasKosztorysReading` / `NoKosztorysData`). Every v2 figure on the row is already computed for a
  no-kosztorys investment (robocizna 0, bilans, marża) — **except** `subcontractorRemaining`, which
  `shape-investments.ts:103-106` sets to `undefined` when `clientTotals === undefined`.
- The investment page's Podsumowanie **never** withholds: with an empty kosztorys it reads 0 robocizna
  and the reconciliation warns. Removing the gate makes the listing agree with the panel.
- There is a **SQL twin** of the gate: `src/lib/db/worker-payout-pairs.ts:32`
  (`AND EXISTS (SELECT 1 FROM kosztorys_items …)`), feeding the „Rozlicz wypłaty" dialog, the
  `/pracownicy` per-worker pairs and the listing's `subcontractorsOwed`. Its invariant
  „Σ pairs = listing Pozostało" (`worker-payout-pairs.ts:15-16`) breaks for no-kosztorys rows if only
  the listing changes.
- `hasKosztorys` must **stay on the row** — `trash-investment-button.tsx:19,28` uses it to skip the
  „kosztorys w użyciu" server check.
- **Prod data (today's dump, 2026-10-02 08:06):** 145 non-trashed investments, **97 without a
  kosztorys**. Of those, **71 have robocizna/rabat booked as transfers** (3 530 395,73 zł robocizna,
  17 801,26 zł rabat) and **79 have wypłaty** (2 280 248,44 zł). Only **15** carry neither — the
  Kijowska shape. So the gate today mostly hides legacy investments, not materials-only ones.

## Detailed Findings

### Listing cells (`src/components/tables/investments.tsx`)

| Line    | What                                                | After removal                                                                  |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| 41-52   | rationale comment + `hasKosztorysReading`           | delete                                                                         |
| 54-56   | `NoKosztorysData` („brak danych")                   | delete                                                                         |
| 64-68   | `withheldFigureCell` (Marża v2, Pozostało fallback) | renders „ustaw etapy" only on `undefined`                                      |
| 86-89   | `balanceOrUndefined` sort accessor                  | no-kosztorys rows sort by their real bilans, not last                          |
| 134-138 | Bilans netto v2                                     | real bilans                                                                    |
| 146-149 | Bilans brutto v2                                    | real bilans (still „nie dotyczy" outside tryb brutto)                          |
| 203-204 | Robocizna v2                                        | 0,00 zł + the rozjazd icon wherever v1 has robocizna (intended flag)           |
| 259-263 | Pozostało do wypłaty                                | `−wypłaty` (if `shape-investments` also changes); link opens „Rozlicz wypłaty" |

„nie dotyczy" on Bilans brutto v2 for Kijowska (#152, tryb `NET`) is **correct and unrelated** — the
tryb decides which bilans exists (owner, 2026-08-23).

### Row shaping (`src/lib/queries/shape-investments.ts`)

- :101 `marginV2` — already ungated by presence; `margin-v2.ts:32` returns `null` only on
  `hasUnconfirmedPlane`. No kosztorys → `0 − 0 − 0 − totalSettled − totalLoss`.
- :103-106 `subcontractorRemaining` — drop `clientTotals === undefined ||`. With `NOTHING_DUE`
  (`subcontractor-due.ts:18`, `{ due: 0, hasUnconfirmedPlane: false }`) the value is
  `roundToCents(−totalPayouts)`.
- :114 `hasKosztorys` — keep (trash button).

### Investment page (no withhold — already the target behaviour)

- `src/app/(frontend)/inwestycje/[id]/page.tsx:110-128` always renders `InvestmentSummaryPanel`.
- `investment-summary-panel.tsx:52-53` empty tree → zero client totals; `:87-94` reconciliation warns
  on empty kosztorys vs booked transfers.
- `summary-reading.ts:27-41` no kosztorys → 0 robocizna / 0 rabat.
- `margin-actual-table.tsx:93` hides „Rozliczenie z ekipą" only when `due === 0 && totalPayouts === 0`,
  else prints „Nadpłata" = wypłaty — the same `−wypłaty` the listing would print.
- Cosmetic gap: with 0 wypłaty the listing prints a green 0,00 zł where the panel hides the block.

### Worker payout pairs (SQL twin)

`src/lib/db/worker-payout-pairs.ts:18-20,32` — `EXISTS kosztorys_items`. Consumers:

- listing `subcontractorsOwed` (`queries/investments.ts:33,42`) — unaffected (nobody owed on no kosztorys);
- `/pracownicy` (`pracownicy/page.tsx:16` → `tables/users.tsx:41-80`) — legacy wypłaty never show as nadpłata;
- „Rozlicz wypłaty" dialog (`queries/settle-payouts.ts:44`) — would open on „Brak wypłat do rozliczenia."
  (`settle-payouts-form.tsx:190-191`) from a listing cell showing e.g. −313 722,50 zł;
- the booking action (`actions/settle-payouts.ts:71`).

Archived EX-919 (`context/archive/2026-09-29-worker-payout-remaining/change.md:37-38`) chose the
exclusion on purpose: 171 pairs / 2,77 mln zł of legacy wypłaty would paint long-standing workers as
overpaid.

### Header tooltips (`src/components/tables/investments-header-tips.ts`)

`:6` `FROM_KOSZTORYS` („Bez kosztorysu — „brak danych".") feeds `:15` balance, `:16` balanceGross,
`:18` marginV2; `:22` Robocizna v2 and `:29` Pozostało say the same. All need rewording.

### Types

`src/types/table-rows.ts:47-52` (`subcontractorRemaining` „absent without a kosztorys") and `:61-66`
(`hasKosztorys` „the v2 columns withhold on this") — reword; the latter's remaining reader is the trash
shortcut.

### Tests

- `src/__tests__/lib/queries/shape-investments.test.ts`
  - :421-450 — absent vs zero-progress kosztorys; drop the `subcontractorRemaining: undefined` override.
  - :565-568 „withholds the figure for an investment with no kosztorys" — flip to `−wypłaty` (−1000).
  - :452-467, :514-519, :570-580 — stay.
- `src/__tests__/investment-render-parity-db.test.ts:233-241` — mirrors the gate in its expected value;
  drop `invTotals === undefined ||`.
- `src/__tests__/lib/db/worker-payout-pairs.test.ts:207,321-326,333` — change only if the SQL `EXISTS`
  is lifted.
- No component spec for `investments.tsx`; no e2e asserts the listing's „brak danych"
  (`e2e/investments-listing-kosztorys.spec.ts` reads a seeded investment that has a kosztorys).
- Other „brak danych" hits in src/e2e (fleet, equipment, transfer-filters, expense-datasets,
  data-table empty row) are unrelated.

### Prod data (local DB = today's restore; cross-checked against `dumps/dump-latest.sql` 2026-10-02 08:06)

Predicate replicated from `src/lib/db/kosztorys-client-totals.ts`: has kosztorys ⇔
`EXISTS (SELECT 1 FROM kosztorys_items WHERE investment_id = i.id)`.

| status    | non-trashed | no kosztorys |
| --------- | ----------- | ------------ |
| active    | 46          | 22           |
| completed | 88          | 74           |
| planowana | 7           | 1            |
| quote     | 2           | 0            |
| szablon   | 2           | 0            |
| **Σ**     | **145**     | **97**       |

Among the 97:

| Shape                            | Count                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| LABOR_COST and/or RABAT booked   | 71 (11 active) — robocizna 3 530 395,73 zł, rabat 17 801,26 zł |
| PAYOUT booked                    | 79 (15 active) — 2 280 248,44 zł                               |
| both                             | 68                                                             |
| payouts without robocizna        | 11 (e.g. #26 Uniwersytet Warszawski 313 722,50 zł)             |
| neither (materials-only / empty) | 15                                                             |

Kijowska: #152 „Kijowska 17 dwa mieszkania", active, `NET`, 0 kosztorys items, 6× INVESTMENT_EXPENSE
(18 856,21 zł) + 1× CORRECTION (−195 zł) = the 18 661,21 zł on the screenshot. The „…materiały" suffix
is a rename made after the 08:06 dump.

Visible effect of removing the gate, by shape:

- **15 materials-only**: the fix the owner asked for — bilans = −materiały, robocizna 0, marża real.
- **71 legacy with v1 robocizna**: Bilans netto v2 drops the booked robocizna (client looks owed less /
  in credit), Robocizna v2 0,00 zł **with the rozjazd icon** — the v1 column sits beside it, and
  AGENTS.md already frames that gap as the to-do list, not a defect.
- **79 with wypłaty**: Pozostało do wypłaty = −wypłaty (reads as nadpłata) — only if
  `subcontractorRemaining` changes too.

## Code References

- `src/components/tables/investments.tsx:41-68,86-89,134-149,203-204,259-263` — the gate
- `src/lib/queries/shape-investments.ts:103-106,114` — `subcontractorRemaining` withhold, `hasKosztorys`
- `src/lib/db/worker-payout-pairs.ts:15-20,32` — SQL twin + Σ invariant
- `src/components/tables/investments-header-tips.ts:6,15,16,18,22,29` — tooltip copy
- `src/types/table-rows.ts:47-52,61-66` — JSDoc
- `src/components/investments/trash-investment-button.tsx:19,28` — keeps `hasKosztorys`
- `src/lib/kosztorys/margin-v2.ts:32`, `src/lib/kosztorys/subcontractor-due.ts:15-18` — already presence-free
- `src/__tests__/lib/queries/shape-investments.test.ts:421-450,565-568`, `src/__tests__/investment-render-parity-db.test.ts:233-241` — specs to flip

## Architecture Insights

- The figure layer already follows the rule „an empty kosztorys is an answer, not a question"
  (AGENTS.md, `summary-reading.ts`, `NOTHING_DUE`). Only the listing's render layer (and the
  Pozostało row field, and the worker-pairs SQL) contradict it. Removing the gate re-aligns the
  listing with the panel: one formula, one presentation.
- The rozjazd icon on Robocizna v2 was suppressed by the gate — removing it restores the v1/v2
  work-queue signal on exactly the 71 legacy investments EX-712 is waiting on.

## Historical Context (from prior changes)

1. 2026-07-19, roadmap S-12 (`context/foundation/roadmap.md:467-468`) — first plan kept a transactions
   fallback. `:474` already asked: „Fixed-price job with no kosztorys — … is „no kosztorys → 0"
   acceptable?" — never answered; today's ruling answers it.
2. 2026-08-12, EX-555 `f72c68a1` (`context/archive/2026-08-12-ex-555-write-switch-labor-rabat/change.md:36-39`)
   — fallback revoked; empty kosztorys = 0 zł; listing showed a **real 0** („the gap is the to-do list").
3. 2026-08-19, `3f8a2f2e` — „brak danych" on four v2 columns (no change folder; direct commit).
   `9a823200` added the AGENTS.md sentence + tooltips.
4. 2026-08-24, `30de8ceb` — gate re-keyed from `totalLaborCosts !== 0` to `hasKosztorys`.
5. 2026-09-29, `0ff18315`/`57e97c77`/`0d7130fc` — gate extended to Pozostało do wypłaty with its own
   rationale („−wypłaty would paint every legacy investment as overpaid"); plan/research readable via
   `git show 0d7130fc:context/changes/2026-09-29-investments-list-payout-remaining/research.md`.
6. 2026-09-29, EX-919 — the same exclusion for per-worker pairs.

No doc anticipated a legitimate materials-only investment; every rationale assumed „no kosztorys =
legacy work not entered yet".

## Docs to update

- `AGENTS.md:390` — the sentence „The listing RENDERS that zero as „brak danych" on its v2 columns …"
  becomes false; the rest of the paragraph (0 zł, v1 vs v2 is the source choice) stays and now explains
  why the zero is printed.
- `context/foundation/investment-financials-and-discount.md:177-180` — „No kosztorys → „brak danych",
  not `−wypłaty`" (already wrong about Marża v2 today); `:202` only if worker pairs change.
- `context/foundation/manual-checks.md:2071-2073` — ticked check expecting „brak danych".

## Decisions (owner, 2026-10-02)

1. **Bilans netto v2, Bilans brutto v2, Robocizna v2, Marża v2 — gate removed.** No kosztorys prints
   the real figure (robocizna 0 zł). Accepted cost: the active legacy investments with robocizna booked
   only as transfers (group A, 11 active) show a v2 bilans without that robocizna — the rozjazd icon on
   Robocizna v2 flags them.
2. **Pozostało do wypłaty — gate stays, wording changes.** Without a kosztorys the column only
   re-prints „Wypłaty" with a minus, so it carries no information: the cell renders „brak kosztorysu"
   instead of „brak danych" (owner's pick over „—" / „nie dotyczy": it names the cause). `subcontractorRemaining` stays
   `undefined` there; `worker-payout-pairs.ts` keeps its `EXISTS`, so the Σ-pairs invariant, `/pracownicy`
   and „Rozlicz wypłaty" are untouched.
3. **Kosztorys with no executed etapy + wypłaty → −wypłaty stays** (a zaliczka; the panel prints the
   same as „Nadpłata"). Considered and rejected: a „wpisz wykonane etapy" hint — 0 active investments
   are in this state today, and it would need the panel to change in step. Worker assignment
   („przypisz etapy do pracowników") does not affect this figure: `due` depends on executed qty and the
   etap's plane only; the worker only partitions it (`byWorker`).
4. Not taken: withhold only where v1 carries robocizna and the kosztorys is empty.
5. **„nie dotyczy" on the other bilans column → name the tryb** („rozliczenie brutto" in Bilans netto
   v2; „rozliczenie netto" / „rozliczenie mieszane" in Bilans brutto v2). Same rule, said as its
   reason.

## Follow-up Research 2026-10-02 — active investments only

Computed through the real row builder (`shapeInvestments` over `sumAllInvestmentFinancials` +
`select*` from `src/lib/db`, the same inputs `investment-render-parity-db.test.ts` assembles), on the
local DB restored from today's dump. Read-only. 46 active, **22 without a kosztorys**. The bilans
column shown is the one the tryb builds (only #31 is `GROSS`; the rest are `NET`). Negative bilans =
the client owes.

| Group                            | #   | Investments                                                                                                                                                                                                                              | Bilans v1 → v2                                                                                                                                                                    | Robocizna v2                             | Pozostało do wypłaty                           |
| -------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| A. robocizna booked as transfers | 11  | #31 11 Listopada 40, #66 Altowa 12, #32 Kajetany Polanki, #65 Okocimska 9, #85 Planetowa 44a, #88 Przedpole 8a/28, #12 Sierakowskiego 3/81, #58 Potrzebna 55, #40 Dom Dziekanów, #91 „błędna wypłata Stachu", #153 Ząbkowska „zastępcza" | jumps by the booked robocizna, mostly from „owes" to „overpaid" (e.g. Altowa −46 590,80 → +295 743,20; Kajetany −94,29 → +184 216,71; #31 brutto −201 638,72 with v1 −370 075,38) | 0,00 zł + rozjazd icon (= −robocizna v1) | −wypłaty (Altowa −218 811,86; #31 −208 634,00) |
| B. wypłaty, no robocizna         | 4   | #133 Topiel 6, #123 Międzyborska 50/65, #119 Kulisiewicza 16, #38 telmak                                                                                                                                                                 | unchanged except the wpłaty plane (#133 14 774,95 → 11 672,94)                                                                                                                    | 0,00 zł, no icon                         | −5 072,00 / −7 277,40 / −20 905,85 / −3 000,00 |
| C. materials-only / empty        | 7   | #152 Kijowska 17, #158 Taras Okopowa, #131 klimatyzacja materiały, #116 Mieszkanie Bartek, #145 Biesaga, #143 Garbacik, #125 Ziętkowski                                                                                                  | = v1 (#145, #143: −7% on the wpłaty netto plane)                                                                                                                                  | 0,00 zł                                  | 0,00 zł (green)                                |

Marża v2 reads 0,00 zł (or a small −settled/−strata) on every row: it does not deduct wypłaty
(it deducts the kosztorys „należne" ekipie, which is 0), so group A/B's v1 marża (e.g. Altowa
123 522,14) has no v2 counterpart until the kosztorys is entered.
