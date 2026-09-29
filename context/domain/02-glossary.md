---
title: Domain Glossary — App ↔ Code naming map
created: 2026-07-20
updated: 2026-08-17
type: glossary
---

# Domain Glossary — Wykonczymy

One concept per row, in **three registers**: what the **owner sees** (Polish UI / the sheet's name)
and what the **code calls it** (English identifier). It does two jobs at once:

- **Translation** (left columns) — "what is what in code vs the app", so the agent can translate the
  owner's Polish silently and reliably, per AGENTS.md's `Polish UI, English code` mandate.
- **Naming map** (right columns) — the **canonical** code identifier per concept, plus the **drift
  variants** that must converge on it. This is the rename spec **EX-548** executes against.

**EX-548 executed the rename**, so every canonical below is the identifier actually in the tree and
`local/no-domain-drift` (`eslint-rules/no-domain-drift.mjs`) fails the build on a relapse. A
non-empty `Drift in code` cell now means drift that survived on purpose — read its note.

## How to read a row

| Column                | Meaning                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Concept**           | The business figure/thing — the stable key.                                                                                                     |
| **App/UI (PL)**       | The Polish label the owner sees, or says.                                                                                                       |
| **Sheet name**        | The owner's sheet vocabulary (kosztorys rows only; the sheet is domain authority).                                                              |
| **Canonical code id** | The **one** English identifier code should use. Matches the transfers side.                                                                     |
| **Cat**               | **A** = sheet proper noun, Polish allowed as ubiquitous language · **B** = generic figure, English required · **A?** = gray zone, owner's call. |
| **Drift in code**     | Non-canonical identifiers currently in code. Empty = already clean.                                                                             |
| **Lives in**          | Where the concept is derived/defined (`file:line` or slice id).                                                                                 |

Diacritics are the tell: a **code identifier** has none (`marza`), Polish **prose/UI** does (`Marża`).

**Category A is exactly three concepts:** `kosztorys`, `przedmiar`, `pomiar`. The test is **"no clean
English equivalent"**, not "the sheet says it in Polish" — the sheet also says „etapy" and
„robocizna", and those are `stage` / `laborCosts` in code. Anything not on that list of three is
Category B, whatever the sheet calls it.

---

## 1. Financial core — cash ledger + investment P&L (whole app)

The mature, code-enforced domain. Every canonical below now matches transfers/`lib/db`; EX-548 cleared
the drift where kosztorys code had re-typed the same figure in Polish, and `local/no-domain-drift`
keeps it cleared.

| Concept                | App/UI (PL)           | Sheet name  | Canonical code id                | Cat | Drift in code                | Lives in                                                 |
| ---------------------- | --------------------- | ----------- | -------------------------------- | --- | ---------------------------- | -------------------------------------------------------- |
| balance                | Bilans inwestora      | —           | `balance`                        | B   | — (resolved EX-548)          | `calculate-balance.ts:6`                                 |
| register balance       | Saldo kasy            | —           | `registerBalance`                | B   | — (resolved EX-548)          | `lib/queries/register-balance.ts:10`                     |
| margin                 | Marża                 | —           | `margin`                         | B   | — (resolved EX-548)          | `calculate-margin.ts:13`                                 |
| actual margin          | Marża rzeczywista     | —           | `marginV2`                       | B   | — (new, EX-649)              | `kosztorys/margin-v2.ts`                                 |
| margin forecast        | Prognoza              | —           | `marginForecast`                 | B   | — (new, EX-649)              | `kosztorys/margin-forecast.ts`                           |
| subcontractor due      | Należne podwykonawcom | —           | `subcontractorDue`               | B   | — (new, EX-649)              | `kosztorys/subcontractor-due.ts`                         |
| deposit (income)       | Wpłaty                | —           | `deposit`                        | B   | — (resolved EX-548)          | `transfers.ts:58` (`DEPOSIT_TYPES`)                      |
| payout                 | Wypłaty               | —           | `payout` (`PAYOUT`)              | B   | — (resolved EX-548)          | `calculate-margin.ts:14`                                 |
| labor charge           | Robocizna             | „robocizna" | `laborCosts` (`LABOR_COST`)      | B   | — (resolved 2026-07-20)      | `calculate-margin.ts:14`; `transfer-rules.ts:52`         |
| discount               | Rabat                 | „rabat %"   | `discount` (`RABAT`)             | B   | — (resolved EX-548)          | `calculate-margin.ts:14`; `kosztorys-editor-body.tsx:73` |
| loss                   | Strata                | —           | `loss` (`LOSS`)                  | B   | — (resolved EX-548)          | `calculate-margin.ts:5`                                  |
| correction             | Korekta               | —           | `correction` (`CORRECTION`)      | B   | —                            | `validation.ts:7`                                        |
| materials              | Materiały             | „materiały" | `materials`                      | B   | (`materiały` in labels only) | `investment-financials.ts:41`                            |
| settled flag           | Wliczone w robociznę  | —           | `settled`                        | B   | —                            | `transfers.ts:228`                                       |
| transfer / transaction | Transakcja            | —           | `transfer` (slug `transactions`) | B   | —                            | `transfers.ts:52`                                        |
| cash register          | Kasa                  | —           | `cashRegister`                   | B   | —                            | `cash-registers.ts:34`                                   |
| investment             | Inwestycja            | —           | `investment`                     | B   | —                            | `investments.ts:11`                                      |

**Robocizna — ruled `laborCosts` (owner, 2026-07-20).** The transfers side already owned an English
form (`LABOR_COST`, `totalLaborCosts`), and a figure may not carry two names across the recon seam,
so the English form wins over the sheet-noun defense. The `robocizna` key on both the reconciliation
verdict and the summary split → `laborCosts`; the two recon operands take the plane suffixes below.
Polish stays in UI labels („Robocizna",
„Transakcje robocizny", „Wliczone w robociznę") and in prose comments naming the domain concept.

**`bilans` / `marza` — ruled `balance` / `margin` (owner, 2026-07-20).** Common words, no proper-noun
claim ("nothing special about them"). Verified **symbol-only**: local vars + the `{ bilans, marza }`
delta shape in two test/script files + one `print-button.tsx` local — **no** SQL column, Payload field,
or migration column carries these names (the canonical functions are already `calculateBalance` /
`calculateMargin`), so the rename touches **no columns**. Prose („bilans inwestora" tooltips) stays.

**`rabat` — ruled `discount` (owner, 2026-07-20).** Same shape as the others: `discount` is a clean
equivalent and `RABAT` / `totalRabat` already exist on the transfers side. The lowercase Polish code
forms → `discount*` (`rabat` → `discount`, `rabatNet` → `discountNet`, `rabatAmount` → `discountAmount`).
`rabatClientNet` is the one exception — it is a **recon operand**, so it takes a plane suffix
(`discountNetFromKosztorys`) rather than the bare form the 2026-07-20 note proposed; see the plane-suffix
section below. The **uppercase `RABAT`** transfer-type enum value **stays** — it's the canonical DB enum
constant, not drift. Polish stays in UI labels („rabat %", „Rabat").

**`saldo` — ruled `registerBalance` (owner, 2026-08-15).** Polish `saldo` and `bilans` both translate
to `balance`, so translating them naively would create the very collision this glossary exists to
prevent. `balance` stays with the **investment** figure, which already owns the name in code
(`calculateBalance`) and in a DB column; the cash-register family takes the `register*` prefix. The
inverse choice would have renamed a correct name and split code from schema. The default string
`label = 'Saldo'` stays.

### Plane suffixes — the exception to "one concept, one name"

Two figures can be the **same concept on different planes** and still be **different values by
design**. The recon seam is built to scream when they disagree (`buildKosztorysReconciliation`), so
collapsing them onto one bare name destroys the distinction the alarm rests on.

**The rule (owner, 2026-07-20): keep the canonical base name identical on both sides, and append
`FromKosztorys` / `FromTransactions`.** The shared prefix is what makes the pair legible as one
concept; the suffix is the only thing that differs, so a reader can't mistake which side they hold.

| Concept      | kosztorys plane              | transactions plane                               |
| ------------ | ---------------------------- | ------------------------------------------------ |
| labor charge | `laborCostsNetFromKosztorys` | `laborCostsNetFromTransactions` (Σ `LABOR_COST`) |
| discount     | `discountNetFromKosztorys`   | `discountNetFromTransactions` (Σ `RABAT`)        |

**These two pairs are the whole list** (verified 2026-08-15 at `reconciliation.ts:120-121`, which
compares exactly two figures). Anything else is one-plane and stays bare.

**A figure that exists on only one plane stays bare** (owner, 2026-07-20) — `depositsByStage`, not
`depositsByStageFromKosztorys`. The suffix is a warning that a twin exists; hanging it on everything
turns it into noise that stops warning. Add it when the second plane appears, not before.

`totalLaborCosts` on `investment-financials` keeps its name for the same reason — it's the ledger
aggregate at its own source, not a recon operand. The suffix applies where the two meet.

Two prior passes got this wrong: `robociznaNet` → `laborCostsNet` fixed the language but dropped the
plane; `laborFromKosztorysNet` carried the plane but mangled the base name, so the pair no longer
shared a prefix. **A language ruling does not settle the plane question — check this section before
renaming anything the reconciliation compares.**

**A type can carry the plane instead of the name (owner, 2026-08-15).** `SummaryReadingT`
(`summary-reading.ts:14`) is a plane-selection wrapper: two producers build it, one per plane, and
every consumer holds exactly one. Its fields therefore stay **bare** — `discountAmount`, not
`discountAmountFromKosztorys` — because the type already answers the question the suffix would
answer, and a suffix hung where it adds nothing is the noise this section warns about. The rule
generalises: **suffix the figure only where both planes are in scope at the same time**, which in
practice means the two operand pairs above and nothing else.

Same reasoning closes the subcontractor figures: `remaining` and `dueNet`
(`subcontractor-summary.ts:138`) exist on one plane only and stay bare.

---

## 2. Kosztorys — editor domain

| Concept                | App/UI (PL)          | Sheet name            | Canonical code id                                                                                                   | Cat | Drift in code                                                      | Lives in                     |
| ---------------------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------ | ---------------------------- |
| kosztorys (the budget) | Kosztorys            | „kosztorys_robocizny" | `kosztorys` (slug `kosztoryses`)                                                                                    | A   | (`Sheets`/`sheets.ts` legacy)                                      | `sheets.ts:13`               |
| section                | Sekcja               | wiersz sekcji         | `section`                                                                                                           | B   | —                                                                  | S-01                         |
| item                   | Pozycja              | wiersz pozycji        | `item`                                                                                                              | B   | —                                                                  | S-01/S-02                    |
| stage                  | Etap                 | „etapy"               | `stage`                                                                                                             | B   | — (rename landed EX-536)                                           | S-04                         |
| summary block          | Podsumowanie         | „Podsumowanie"        | `summary`                                                                                                           | B   | — (resolved 2026-07-20)                                            | `kosztorys-summary.tsx`      |
| combined R+M           | Łącznie              | „Łącznie"             | `combined`                                                                                                          | B   | — (resolved 2026-07-20)                                            | `summary-economics.ts:37`    |
| planned qty            | Przedmiar            | „Przedmiar" (N)       | `przedmiar`                                                                                                         | A   | —                                                                  | S-01                         |
| stage-sum qty          | Pomiar z natury      | „Pomiar z natury" (O) | `pomiar`                                                                                                            | A   | —                                                                  | S-01                         |
| unit price (client)    | Cena j.m.            | „Cena j.m." (Q)       | `unitPrice`                                                                                                         | B   | —                                                                  | S-02                         |
| net value              | Wartość netto        | „Wartość netto" (T)   | `netValue`                                                                                                          | B   | —                                                                  | S-02                         |
| deposit VAT plane      | Wpłata netto/brutto  | —                     | `vatPlane` (`VatPlaneT`, `VAT_PLANES`)                                                                              | B   | — (EX-536; NET/GROSS/null, null⇒netto per 2026-07-23 flip)         | `constants/transfers.ts:138` |
| payment method         | Metoda płatności     | —                     | `paymentMethod` (`PaymentMethodT`)                                                                                  | B   | — (EX-536; CASH/TRANSFER)                                          | `constants/transfers.ts:121` |
| cash settlement        | Rozliczenie mieszane | —                     | `computeCashSettlement` (`CashSettlementT`: `combinedNet`/`remainderNet`/`remainderGross`/`invoice`/`cash`/`total`) | B   | — (EX-536)                                                         | `summary-economics.ts:125`   |
| deposits split         | Rozliczenie wpłat    | —                     | `depositsSplit` / `bucketDepositsByPlane` (`DepositsSplitT`: `paidNet`/`paidGross`/`remainingNet`/`remainingGross`) | B   | — (EX-536)                                                         | `summary-economics.ts:144`   |
| deposit row            | Wpłata (wiersz)      | —                     | `DepositTransactionRowT`                                                                                            | B   | — (EX-536)                                                         | `types/reference-data.ts:63` |
| the paying party       | Inwestor             | —                     | `client*` (see note)                                                                                                | B   | `clientView`, `clientPrice`, `view === 'client'` — ruled permanent | `client-view/settings.ts`    |

**`stage deposit` / `zaliczki` — retired (EX-536).** The deposit→etap tagging bridge is gone:
`lib/kosztorys/zaliczki.ts` deleted, the `kosztorys_stage_id` column dropped from `transactions`
(migration `20260721_0`), and `zaliczkiByStage` removed from the editor data. Deposits are no longer
tagged to a stage — the concept has no code referent to name. (It was EX-548's canonical worst-offender
example: `Zaliczka*` exports importing `isDepositType`; the example is retired with the code.)

**„Inwestor" in the UI is `client*` in code (2026-08-17) — one concept, two registers.** The person
paying for the job is „Inwestor" everywhere the owner can read it: the view axis, „Widok inwestora",
„Udostępnij inwestorowi", the Payload labels, and the route `/podglad-inwestora`. The code below it
still says `client` — `clientView` / `ClientViewSettingsT`, `clientPrice`, the `view === 'client'`
price plane, `collections/kosztorys-client-view.ts`, `lib/actions/kosztorys-client-view.ts`. **Reading
either word, mean the same person.** „Klient" survives in the UI in exactly one unrelated place: a CRM
lead (`components/tables/leads.tsx`), which is a prospect, not a payer.

**The rename is ruled off, not pending — EX-704 canceled (2026-08-25).** Measured at 123 files /
~880 sites and dropped: the benefit sits entirely on the `tsc`-visible half, which never expires, while
the deadline sits on the persisted half (the `client_price` column + five payload surfaces), which is
worth nothing and carries all the risk. **This entry is the deliverable — reading either word, mean the
same person, and that needs no code change to hold.** Rationale: `lessons.md`, „A rename splits into two
halves with opposite economics".

**Never rename the column or a persisted key.** If a later edit lands in one of these files anyway, a
`tsc`-visible symbol may be renamed in that same commit — but a half-swept tree is worse than a
consistently `client*` one, so where that would leave the two words mixed across files, leave `client`
alone. The target, if the sweep is ever taken wholesale, is **`investor*`** — never `investment*`, which
already denotes the **project** (`investmentId`), a different thing one word away; the confirm gate added
with the UI rename already reads that way (`investorImpactConfirm`). `clientPrice` is a Payload scalar
and scalars take no `dbName`, so renaming it would be a migration, not a symbol change.

**`etap` — ruled `stage` (2026-07-20), NOT a proper noun.** It was listed `A` on the "the sheet says
etapy" reflex, but `stage` is already the code's dominant word (`stage*` outnumbers `etap`-identifiers
~15:1 — `stageId`, `kosztorysStage`, the `stage-progress` collection). A concept with a clean English
equivalent already in use fails the Category-A test, whatever the sheet calls it. Rename landed (EX-536):
`KosztorysEtapTotals` / `kosztorys-etap-totals.tsx` → `KosztorysStageTotals` / `kosztorys-stage-totals.tsx`,
and the `orphaned-etap-tag` test file was deleted with the bridge. Polish stays in UI labels („Usuń etap",
„Bez etapu") and prose.

**`podsumowanie` — ruled `summary` (2026-07-20), NOT a proper noun.** Same test as `etap`: naming the
sheet's specific „Podsumowanie" block is not enough when `summary` is a clean English equivalent.
Renamed: `computePodsumowanie` → `computeSummary`, `PodsumowanieT` → `SummaryT`,
`KosztorysPodsumowanie` → `KosztorysSummary`, `kosztorys-podsumowanie.tsx` → `kosztorys-summary.tsx`.

**`lacznie` — ruled `combined` (2026-07-20).** Not `total`: `totalNet` already denotes the _executed_
total in `use-kosztorys-editor.ts`, and „Łącznie" is the Robocizna+Materiały combination — a different
figure. `combined` / `combinedNet` keeps them distinguishable. This row was missing from the glossary
entirely; it surfaced only because `computeSummary` returned a half-renamed `{ laborCosts, lacznie }`.

**`sumaPrac` / pre-rabat robocizna — ruled `laborCostsNetPreDiscount` (owner, 2026-08-15), with one
operation split off.** Three code paths produced this figure: `sumaPracPreRabat(laborCostsNet,
rabatAmount)`, the `sumaPracNet` field, and `executedWorkNetPreRabat(subtotals)`. On the **client
view** all three yield the same złoty. They are **not** interchangeable elsewhere:
`executedWorkNetPreRabat` is view-agnostic and deliberately omits the global-discount add-back,
because the crew is owed its price regardless of a concession made to the client. One name over both
would assert an equality that is false on `w_tools` / `no_tools`.

So the unification is one name per **figure** plus a separate name for the **operation**:
`laborCostsNetPreDiscount(laborCostsNet, discountAmount)` is the figure;
`sumSectionSubtotalsNet(subtotals)` is a sum over sections and says so. Composing them keeps the
parity oracle honest on every view.

### Kosztorys settlement panel — canonical names (2026-08-15)

| Concept                  | App/UI (PL)          | Canonical code id                           | Drift renamed from                            |
| ------------------------ | -------------------- | ------------------------------------------- | --------------------------------------------- |
| amount still owed        | Pozostało do zapłaty | `amountDue` (`computeAmountDue`)            | `doZaplaty*`, `computeDoZaplatyRM`            |
| outstanding net          | Do rozliczenia       | `outstandingNet`                            | `doRozliczeniaNet`                            |
| cash remainder           | Reszta               | `remainderGross`                            | `resztaGross`                                 |
| executed value           | Wykonane             | `executedNet`                               | `wykonaneNet`                                 |
| labor charge (billed)    | Robocizna            | `laborCostsNet`                             | `robocizna` (field)                           |
| materials (billed)       | Materiały            | `materialsBilled`                           | `materialy` (field)                           |
| expense dataset          | Wydatki              | `ExpenseDatasetT`, `partitionExpenseRows`   | `WydatkiDatasetT`, `partitionWydatkiRows`     |
| labor tab (sheet import) | zakładka robocizny   | `laborGrid`, `parseLaborTab`, `laborTabGid` | `robocizna`, `parseRobocizna`, `robociznaGid` |
| pie-chart base           | Przedmiar/Wykonane   | `SectionPieBaseT = 'planned' \| 'executed'` | `'przedmiar' \| 'wykonane'`                   |

`SectionPieBaseT` is worth calling out: it is a **string union**, and the `local/no-domain-drift`
guard matches `Identifier` nodes only, so a Polish union value is invisible to it. This one was found
by reading, not by the rule, and the next one will be too.

---

## 3. DB-column guardrail

Canonical identifiers that map to a **real shared Postgres column** on prod data (`balance`, `margin`
on transfers/investments) — a **symbol** rename is safe; a **column** rename is a separate, careful
step and is **out of scope** until explicitly decided. Kosztorys columns are throwaway pre-dogfooding
(AGENTS.md) so their renames carry no data cost.

**Polish string values that are frozen by a migration** — these look like drift and are not; renaming
either one is a schema change, so both stay until someone decides otherwise:

| Value         | Where it is frozen                                                                       | Also appears as                                                                         |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `'RABAT'`     | `enum_transactions_type` (`src/migrations/20260611_add_rabat_enum.ts:7`)                 | a URL query-filter value in `transfer-filters.tsx`; key in `constants/transfers.ts:146` |
| `'planowana'` | `INVESTMENT_STATUSES` (`src/lib/constants/investment-status.ts`), migration `20260718_0` | investment status filters                                                               |

**Verified clean (2026-08-15):** no identifier in the EX-548 drift inventory is a DB column, a Payload
field, or a key inside persisted JSON. In particular `rabat_client_net` / `suma_prac_net` /
`global_rabat_net` (`src/lib/db/kosztorys-client-totals.ts:86-88`) are **SQL aliases, not columns** —
free to rename. The newest persisted surface, `kosztoryses.sheet_column_mapping`, already uses English
keys (`ColumnFieldT`, `sheet-import/columns.ts:36-43`).

## Related documents

- **`01-domain-distillation.md`** — the DDD distillation this glossary sharpens; its KROK 1 is the
  descriptive backbone, this file adds the prescriptive canonical + drift columns.
- **EX-548** — the naming-drift finding and rename backlog; references this glossary as the spec.
- **`context/reference/kosztorys-editor-domain-notes.md`** — the sheet-column map and business prose;
  the register-mapping mandate there points here for the code↔UI translation.
- **AGENTS.md** › `Polish UI, English code` — the rule; its inline term list defers to this glossary.
