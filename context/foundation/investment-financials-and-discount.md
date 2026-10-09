# Investment financials: how marża / materiały / robocizna / korekty connect

> Source of truth for the numbers: `src/lib/db/investment-financials.ts` (`deriveFinancials`),
> `src/lib/db/calculate-margin.ts`, `src/lib/db/calculate-balance.ts`,
> `src/components/investments/financial-stats.tsx`.

## TL;DR — the one thing that's non-obvious

There are **two independent ledgers** sitting on the same `transactions` table, and they
barely talk to each other:

1. **Cash ledger (kasy / transfers)** — real money in/out of registers. Every row here has a
   `source_register`. This is "the transfer system".
2. **Investment P&L** — derived numbers shown on the investment page: **Bilans inwestora**
   (the client's account) and **Marża** (company profit, admin-only).

**`robocizna` (LABOR_COST) lives ONLY in ledger 2.** It has _no source register_ — it's not
a cash movement, it's a billing/markup figure (what the company charges the investor for
labour). It never moves a złoty between registers; it only feeds the P&L.

The base model: **`marża` starts from robocizna alone, `bilans` from wpłaty minus costs.**
Five modifier types (`korekta`, `rabat`, `strata`, `premia`, `settled` material) bend those two
formulas — see the table below.

## Where robocizna and rabat come from (EX-555)

The **formulas** below are unchanged; what moved is **where two of their inputs are read**.
Since EX-555 robocizna and rabat come from the **kosztorys** — and from nowhere else. There is
no fallback: an investment with no kosztorys reads **0 zł robocizny and 0 zł rabatu**, however
many `LABOR_COST` rows it carries. An empty kosztorys is an answer, not a question to forward
to the transfers.

Historical `RABAT` transfers (June 2026) are mostly **balance plugs** (amount = −bilans, e.g.
14,21 zł), not commercial discounts — evidence in `context/archive/2026-07-15-kosztorys-global-discount/`.
Read them that way when EX-712 retires the type.

- **v1 vs v2 is the source choice, and it is the only one.** v1 renders the transactions plane;
  v2 and the listing render the kosztorys. Legacy robocizna booked as transfers stays readable
  on v1 until someone enters that work into the kosztorys — it is **not** backfilled, and no
  figure silently swaps planes to cover for it.
- **v2 materiały carry no breakdown** (owner, 2026-09-15, EX-596): v2 shows the amount the investor
  actually pays, never how it was reached — no „w tym obniżka materiałów" sub-line. The breakdown
  stays on v1 only (`MATERIALS_DISCOUNT_LABEL`); its absence from v2 is a decision, not a gap.
- One rule, one place: `readingFromKosztorys` / `financialsOnReading`
  (`src/lib/kosztorys/summary-reading.ts`), applied by the listing (`shape-investments.ts`),
  the v2 Podsumowanie and the v2 Marża tab.
- The kosztorys pair is folded in Postgres for every investment at once
  (`src/lib/db/kosztorys-client-totals.ts`), pinned against the TS reference formula by a
  DB-backed parity spec.
- `LABOR_COST` / `RABAT` are **offered by the transfer dialog again, temporarily** (EX-649,
  reversing that half of EX-555; EX-712 closes it). Removing them assumed the kosztorys was
  already in the app — for an investment whose kosztorys is still a spreadsheet, the reading
  returns 0 zł and the dialog refusing the booking left no way to settle it at all. Both are
  offered for every investment with no gating: the resulting double-counting is made **visible**
  by the „Robocizna v1 / v2" columns on the listing (rozjazd jako ikona przy v2) and by the v2
  reconciliation,
  rather than prevented. v2 itself is structurally immune — `readingFromKosztorys` **replaces**
  rather than adds, so a hand-booked `LABOR_COST` moves the v1 figures only.
- The **reconciliation** on the investment page screams for an investment with booked transfers
  and an empty kosztorys. That is correct: it is the list of work still to be entered.
- Every other figure here — wpłaty, materiały, wypłaty, korekty, strata — is a cash movement
  the kosztorys knows nothing about and stays transaction-sourced.

---

## The transaction types and where each one lands

```mermaid
flowchart TD
    T[type + amount + investment_id<br/>+ optional source_register / expense_category]
    T --> CASH{has source_register?}
    CASH -->|yes| LEDGER1["LEDGER 1 — Cash registers (real money)"]
    CASH -->|no = LABOR_COST / RABAT / LOSS| SKIP1["does NOT move cash"]

    T --> ROUTE{type}
    ROUTE -->|INVESTMENT_EXPENSE / CORRECTION| MAT[materiały]
    ROUTE -->|CORRECTION ±| KOR[korekty]
    ROUTE -->|INVESTOR_DEPOSIT<br/>COMPANY_FUNDING<br/>OTHER_DEPOSIT| INC[wpłaty / income]
    ROUTE -->|LABOR_COST| ROB[robocizna]
    ROUTE -->|PAYOUT| PAY[wypłaty]
```

- `materiały` = `Σ INVESTMENT_EXPENSE + Σ CORRECTION`, **excluding rows flagged `settled`**
  (`investment-financials.ts:41`). Corrections fold into the material total.
- `korekty` is the **same CORRECTION rows** surfaced as their own line. A CORRECTION can be
  negative (invoice credit).
- `robocizna` = `Σ LABOR_COST`; `wypłaty` = `Σ PAYOUT`.

---

## The two displayed numbers (current formulas)

`deriveFinancials` (`investment-financials.ts:34`) is the single funnel — every `total_*`
aggregate flows from there into the two formulas:

- **Bilans inwestora** (`calculate-balance.ts:6-8`):
  `wpłaty − (materiały + robocizna) + rabat` — client-facing balance.
- **Marża** (`calculate-margin.ts:13-14`):
  `robocizna − wypłaty − rabat − strata − settled`. **Plain materiały are absent on purpose**
  (see below).

### Why plain materiały are absent from marża

> Materials are a **pass-through cost billed to the client**. The client funds them via
> deposits, so they cancel out and never become the company's cost. Profit comes only from
> the labour markup.

That holds for "materiały osobno, robocizna osobno" jobs. The `settled` flag (R+M jobs) is
the exception — material the company eats, so it _does_ hit marża.

**Settled material is a netto cost — owner ruling, 2026-07-26** (not a mode, nothing to gate). Open
gap: `totalSettled` still sums the brutto `amount` of a brutto-booked settled expense, so marża is
understated by its VAT. Parked because a brutto expense stores neither a netto nor a VAT rate, and
the investment's `vatRate` is the client's rate on prace, not the shop's. Tracked as EX-898 (EX-595,
which held it before, no longer exists).

**The reclaimed VAT does not change this — owner ruling, 2026-07-26.** The company deducts input
VAT, so a 1230 zł receipt costs it 1000, while the client returns the full 1230 (they pay exactly
the amount entered in the form; nothing is added on top at rozliczenie netto or mieszany). It is
tempting to read that 230 as an unbooked profit and give marża a `+VAT` term for it. **Don't** —
the owner has rejected it twice, in his own words: „materiał to koszt, który klient zwraca w cenie
brutto", „nie zapisujemy tych 230 zł jako zysk". Pass-through means pass-through on both axes. The
consequence that matters downstream: a materiały concession (billing the client netto instead of
brutto) is a straight give-away that lowers marża, not the return of an earn that was never
booked. **That consequence is stated for the v1 marża** — the figure `calculate-margin.ts` computes;
the second figure below drops the term for an unrelated reason.

---

## The second marża — prognoza and marża rzeczywista (EX-649, 2026-08-18)

The formula above is untouched and still live on v1, `/raporty` and the `Marża` column. Beside it the
kosztorys panel and the listing now carry a second reading, because the first one answers a question
the owner was not asking: it prices the crew from **wypłaty**, so a crew paid late reads as profit
and a crew paid ahead as a loss.

- **Prognoza** (`margin-forecast.ts`): the whole przedmiar at the client price, less the same
  przedmiar at one crew's stawka. A scenario — z narzędziami or bez narzędzi — not a figure that
  moves with progress. It knows nothing of rabat (nobody grants one up front), strata, or material
  priced into robocizna. On rows where material sits inside cena j.m. the przedmiar carries the
  material's revenue and none of its cost, so the prognoza stands structurally above the marża
  rzeczywista and the two never converge; the gap is the material.
- **Marża rzeczywista** (`margin-v2.ts`):
  `robocizna − rabat − należne podwykonawcom − premia − materiał wliczony w robociznę − strata`.
  Two deliberate departures from the v1 formula:
  - `wypłaty` out, **należne podwykonawcom** in — executed etapy valued at the plane each etap
    carries. What is owed moves with the work; cash moves on its own rhythm.
  - `materialsNetDiscount` out. **This is the removal of a term, not the booking of reclaimed VAT as
    profit** — the ruling above stands and stays binding. Billing materiały netto rather than at the
    brutto receipt is a concession on a pass-through; it belongs in the bilans, not in a figure about
    robocizna.
- **It can refuse to be a number.** An etap holding executed work with no rozliczenie contributes
  nothing to należne while its robocizna still counts, so the figure would read high by an unknown
  amount. `marginV2` returns `null` there and every surface renders a call to action. Zero would
  assert the crew worked for free.
- **The prognoza does not signal how a stawka was set** (owner, 2026-08-18). A hand-typed amount is
  separate per view, so the scenario already tells them apart. Measured on 1751 pozycje: 567 carry
  both amounts, 1181 neither, 3 only one — nothing to signal.
- **The prognoza stays off the listing** (owner): it is read per investment, not compared across a
  table.
- **„Rozliczenie z ekipą" sits beside the marża rzeczywista, outside its formula.** The margin alone
  read as a contradiction („the kosztorys says this much, the crew got that much"), so the block is
  shown under it with a caption; wypłaty still don't enter the figure (`margin-actual-table.tsx`).

Guarded by `investment-render-parity-db.test.ts` (listing's `marża v2` vs the same figure computed
from the tree) and by the SQL↔TS parity of the listing fold in `kosztorys-subcontractor-due.test.ts`.

### „Pozostało do wypłaty" on the listing

The same należne feeds a second listing column: the kosztorys Podwykonawcy headline, `należne −
wypłaty`, so the owner can scan where crews are still owed without opening each kosztorys. It
withholds more readily than the panel does, on purpose:

- **Unconfirmed plane → „ustaw etapy".** The panel prints the short należne beside a hint; a list
  scanned for debt cannot, because a short należne understates what is owed — the dangerous
  direction for this figure.
- **No kosztorys → „brak kosztorysu", not `−wypłaty`.** Unlike the other v2 columns (bilans,
  robocizna, marża), which print the real figure with robocizna at zero (owner, 2026-10-02), here
  it would paint every legacy investment as overpaid and sort them in among the real overpayments. A kosztorys with items but no executed work does read `−wypłaty`: the crews were
  genuinely paid ahead.
- **Ungated.** Every management role sees it, although it lets a MANAGER derive Σ wypłat, which the
  „Wypłaty" column hides from them — the owner's call (2026-09-29). The investment page's panel still
  gates the figure behind `canSeeMargin`.

The parity spec compares it with the panel's own `computeSubcontractorSummary`, after applying the
listing's withholding rule to the panel side — otherwise every unconfirmed investment is a false
mismatch.

### „Pozostało do wypłaty" per worker (EX-919)

`/pracownicy` shows the same figure cut by **investment × worker pair**: należne on his etapy at his
stawka − his PAYOUTs on that investment. On an etap split between several workers (EX-943) his
należne is **his share** of the etap's pool — `splitStagePool`, the same rule the editor's panel
runs — so the pairs of one etap still sum to the etap. One read (`fetchWorkerPayoutPairs`) feeds the employee
column, the „Rozlicz wypłaty" dialog from both lists, and sums back to the investment listing's cell.

- **No netting, four figures apart** (owner, 2026-09-29): „do zapłaty aktywne", „do zapłaty
  zakończone", „nadpłata aktywne", „nadpłata zakończone" — each with its count of investments and its
  own kwota; a debt on one job is not paid by a zaliczka on another. The list's „Filtry" menu ticks
  „Aktywne / Zakończone inwestycje" apart (default: aktywne only) — an unticked one drops its two
  lines; nothing to show at all reads a green 0.
- **No kosztorys → no pair**, so legacy PAYOUTs don't paint every long-standing worker as overpaid.
  PAYOUTs without an investment (salary, loans, fuel) are outside the figure entirely.
- **A withheld pair is only that etap's workers'.** An etap with executed work but no rozliczenie
  withholds the pair of every worker in its split; the others on the investment still compute.
- **Unassigned etapy and wypłaty bez pracownika never reach a worker.** They fold into one
  „Nieprzypisane" row, shown greyed in the dialog opened from the investment, so its rows still sum
  to the listing cell.
- **The dialog books on the figures it showed.** The action recomputes each pair at submit and refuses
  the whole batch if any moved; paying past the executed work is allowed, and the PAYOUT's opis gets
  „w tym zaliczka X zł".
- **„Do rozdysponowania" is a calculator, never a booking figure** (owner, 2026-09-30). The owner
  pays out of a fixed sum in hand, so the dialog takes an optional kwota and shows what is left of it;
  it is never sent to the action, the opis or storage. Exceeding it blocks „Wypłać" — typing the kwota
  states the cash limit, so going past it is a mistake. The register's saldo is the opposite: a
  „Saldo po wypłacie" below zero never blocks, because a register may legitimately go negative. The
  preselected register's saldo comes back with the rows from the open-time read, so it shows without
  a mount effect or a second round trip.

The employee list's all-time „Wypłaty" column went: it summed salary, loans and gifts with work pay.

It is a separate dialog, not the wydatek form, because that form holds inwestycja and pracownik once
for every line. A per-worker roster on the wypłata form was built and dropped before (`36a53a48`,
2026-07-29): it put a second, staler copy of the figures beside the amount being typed. That is why
the dialog reads fresh on open and refuses a figure that moved.

**A worker named on an Inny wydatek is the buyer, not a payee (EX-1027, 2026-10-08).** `OTHER` may
carry an optional `worker_id`, so „Inny wydatek" + „narzędzia" + „Pracownik" filtered on the list
reads a person's tool purchases off the „Suma" tile. It moves none of the figures above only because
every money reader of `worker_id` (`get-payout-transactions.ts`, `worker-payout-pairs.ts`) filters
`type IN ('PAYOUT','BONUS')` — a new reader that groups by `worker_id` without that filter counts
tools as wypłaty. The kasa owner can't answer „who bought it": `873bfe43` (2026-03) dropped the field
as redundant with WORKER kasy, but most of the 104 „narzędzia" rows were paid from management kasy.
It is also the one worker editable after save; on PAYOUT / BONUS it is a settlement figure and stays locked.

---

## The five modifiers — how each bends the two formulas

| Type / flag               | source_register | marża | bilans | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORRECTION` (korekta)    | optional        | —     | ↓/↑    | Folds into materiały; may be negative. Moves only the balance.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `RABAT` (rabat)           | **none**        | ↓     | ↑      | Labour discount: company earns less, client owes less. Positive amount. Requires investment.                                                                                                                                                                                                                                                                                                                                                                                |
| `LOSS` (strata)           | **none**        | ↓     | ↑      | Company-absorbed cost the client stops owing (EX-675). Positive amount, investment **required**. Deducts at **face value** on netto and brutto alike — unlike the rabat, a concession on the price, which grosses by VAT.                                                                                                                                                                                                                                                   |
| `BONUS` (premia)          | **none**        | ↓ v2  | —      | Non-cash entitlement on one investment × worker pair (EX-979): raises that pair's „Pozostało do wypłaty" (`due + premia − wypłaty`), lowers **marża v2 only**. v1 leaves it out — there the cash wypłata that pays it already lowers the marża, so subtracting the premia too would count it twice. Investment and worker **required**; a premia with no investment is booked as a wypłata. Never reaches the investor (bilans, share link, protokół) or the owner's sheet. |
| `settled` flag on expense | required        | ↓     | —      | "Wliczone w robociznę": R+M material the company buys but already priced into robocizna. Leaves a register, lowers marża, off the client bill. Valid on `INVESTMENT_EXPENSE` and `CORRECTION` (`transfers.ts:227-239`).                                                                                                                                                                                                                                                     |

`RABAT` and `LOSS` are positive-amount types with **no source register** (billing figures,
not cash movements). `settled` is a boolean on an otherwise normal material expense, so it
keeps `source_register` required.

`settled` is a **flag, not a dedicated type**: type is orthogonal to expense category, so a
type approach would need one type _per category_ (`INTERNAL_BUILDING_MATERIAL`,
`INTERNAL_FINISHING_MATERIAL`, …), multiplying every time a category is added — disqualifying.
A boolean stays orthogonal to the category axis.

Display: `RABAT` and `LOSS` are both green tiles in the credit row of `financial-stats.tsx`
(settled material keeps its own block). `LOSS` now goes **through** `buildFinancialFields` — its
own standalone purple block is gone, and that is what keeps the tiles summing to the bilans they
sit under.

### Three mechanisms compute the bilans, and they must agree

There is no single balance function. Three independent mechanisms produce the same figure on
three surfaces, and any modifier that moves the bilans has to be taught to **all three** by hand:

1. `calculateBalance(financials)` (`src/lib/db/calculate-balance.ts`) — the investments listing.
2. Σ of the tiles from `buildFinancialFields` (`src/lib/queries/investment-financial-fields.ts` →
   `financial-stats.tsx`) — the investment page (v1) and `/raporty`. The header's bilans is the
   **sum of the tiles**, so a term with no tile makes the two readings disagree on one screen.
3. `computeDoZaplatyRM` / `computeMixedSettlement` (`src/lib/kosztorys/summary-economics.ts`) —
   the v2 settlement panel and the client preview.

A modifier taught to only some of them shows one investment two different debts on two screens.
That is the primary risk of any change here, not the arithmetic. The parity guard
(`investment-render-parity-db.test.ts`) exists to catch mechanisms 1↔2 drifting; 3 is pinned by
unit tests plus a whole-investment fixture.

### Face value vs gross-up is a choice between two primitives

Wherever a figure enters the settlement it is written as either `faceValue(...)` — one amount on
the netto **and** the brutto axis — or a `moneyPair`, which grosses by VAT. A wpłata is the
face-value pattern; a rabat is the counter-pattern. Getting the VAT rule right is entirely about
picking the correct primitive at every site the figure appears, not about writing arithmetic.
`span: true` belongs with `faceValue`: without it the row prints an identical netto and brutto,
which reads as a pair that happens to match rather than as one figure covering both axes.

**EX-675 reversed a deliberate earlier decision.** "Strata never touches the bilans" was
intentional, repeated three times in the 2026-06-11 spec, and pinned by a purpose-written test —
but its whole justification was one unexpanded sentence ("a strata is the company's cost, not the
investor's"), which never addressed the case the owner actually has: a strata entered _precisely
so_ the client stops paying. Don't restore the old behaviour from that spec without re-opening the
question with the owner.

**Double-counting is possible and the code cannot detect it.** Marking an expense `settled`
("wliczone w robociznę") _and_ booking a strata for the same amount are two independent rows, so
the bilans moves twice. Accepted knowingly (EX-675). Related: the owner types the amount by which
the client's bill should drop — the app never grosses a strata up, so the figure entered is the
figure deducted.

Specs: `context/reference/superpowers/archive/2026-06-11-investment-rabat.md`,
`context/reference/superpowers/archive/2026-06-11-loss-strata-transfer-type.md`,
`context/reference/superpowers/archive/2026-06-12-settled-internal-material-design.md`.

## MANAGER sees the settled materiały, not the marża (owner ruling, 2026-07-28)

The kosztorys page passes `financials` only for ADMIN/OWNER but `settledBreakdown`
unconditionally, and that asymmetry is deliberate, not an oversight: a MANAGER is meant to read
the rozliczone materiały table while the marża stays hidden. So the visible overlap between
`financials` / `materialsGrossBase` / `materialsNetBilled` / `settledBreakdown` is not redundancy
to collapse — the props carry different audiences, and the gap between them _is_ the access gate.
Deriving `settledBreakdown` from `financials` (a tempting prop-count cleanup) silently deletes that
table for every MANAGER.
