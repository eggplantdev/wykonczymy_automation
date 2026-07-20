---
title: Domain Glossary — App ↔ Code naming map
created: 2026-07-20
type: glossary
---

# Domain Glossary — Wykonczymy

One concept per row, in **three registers**: what the **owner sees** (Polish UI / the sheet's name)
and what the **code calls it** (English identifier). It does two jobs at once:

- **Translation** (left columns) — "what is what in code vs the app", so the agent can translate the
  owner's Polish silently and reliably, per AGENTS.md's `Polish UI, English code` mandate.
- **Naming map** (right columns) — the **canonical** code identifier per concept, plus the **drift
  variants** that must converge on it. This is the rename spec **EX-548** executes against.

This is the **register** (a descriptive snapshot with proposed canonicals), not yet the completed
rename. A row's drift is real until its `Drift in code` cell is empty. The renames are tracked work
(EX-548 + a follow-up whole-app sweep), **not** implied done by listing them here.

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

---

## 1. Financial core — cash ledger + investment P&L (whole app)

The mature, code-enforced domain. Canonicals already match transfers/`lib/db` for most rows; the
drift is where kosztorys code re-typed the same figure in Polish.

| Concept                | App/UI (PL)          | Sheet name  | Canonical code id                | Cat | Drift in code                                        | Lives in                                                 |
| ---------------------- | -------------------- | ----------- | -------------------------------- | --- | ---------------------------------------------------- | -------------------------------------------------------- |
| balance                | Bilans inwestora     | —           | `balance`                        | B   | `bilans`                                             | `calculate-balance.ts:6`                                 |
| margin                 | Marża                | —           | `margin`                         | B   | `marza`                                              | `calculate-margin.ts:13`                                 |
| deposit (income)       | Wpłaty               | —           | `deposit`                        | B   | `wplaty`, `wplatyNet`                                | `transfers.ts:58` (`DEPOSIT_TYPES`)                      |
| payout                 | Wypłaty              | —           | `payout` (`PAYOUT`)              | B   | `wyplaty`                                            | `calculate-margin.ts:14`                                 |
| labor charge           | Robocizna            | „robocizna" | `laborCosts` (`LABOR_COST`)      | B   | — (resolved 2026-07-20)                              | `calculate-margin.ts:14`; `transfer-rules.ts:52`         |
| discount               | Rabat                | „rabat %"   | `discount` (`RABAT`)             | B   | `rabat`, `rabatNet`, `rabatAmount`, `rabatClientNet` | `calculate-margin.ts:14`; `kosztorys-editor-body.tsx:73` |
| loss                   | Strata               | —           | `loss` (`LOSS`)                  | B   | `strata`                                             | `calculate-margin.ts:5`                                  |
| correction             | Korekta              | —           | `correction` (`CORRECTION`)      | B   | —                                                    | `validation.ts:7`                                        |
| materials              | Materiały            | „materiały" | `materials`                      | B   | (`materiały` in labels only)                         | `investment-financials.ts:41`                            |
| settled flag           | Wliczone w robociznę | —           | `settled`                        | B   | —                                                    | `transfers.ts:228`                                       |
| transfer / transaction | Transakcja           | —           | `transfer` (slug `transactions`) | B   | —                                                    | `transfers.ts:52`                                        |
| cash register          | Kasa                 | —           | `cashRegister`                   | B   | —                                                    | `cash-registers.ts:34`                                   |
| investment             | Inwestycja           | —           | `investment`                     | B   | —                                                    | `investments.ts:11`                                      |

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
forms → `discount*` (`rabat` → `discount`, `rabatNet` → `discountNet`, `rabatAmount` → `discountAmount`,
`rabatClientNet` → `discountClientNet`). The **uppercase `RABAT`** transfer-type enum value **stays** —
it's the canonical DB enum constant, not drift. Polish stays in UI labels („rabat %", „Rabat").

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

`totalLaborCosts` on `investment-financials` keeps its name — it's the ledger aggregate at its own
source, not a recon operand. The suffix applies where the two meet.

Two prior passes got this wrong: `robociznaNet` → `laborCostsNet` fixed the language but dropped the
plane; `laborFromKosztorysNet` carried the plane but mangled the base name, so the pair no longer
shared a prefix. **A language ruling does not settle the plane question — check this section before
renaming anything the reconciliation compares.**

---

## 2. Kosztorys — editor domain

| Concept                | App/UI (PL)        | Sheet name            | Canonical code id                 | Cat | Drift in code                                                                                                | Lives in                    |
| ---------------------- | ------------------ | --------------------- | --------------------------------- | --- | ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| kosztorys (the budget) | Kosztorys          | „kosztorys_robocizny" | `kosztorys` (slug `kosztoryses`)  | A   | (`Sheets`/`sheets.ts` legacy)                                                                                | `sheets.ts:13`              |
| section                | Sekcja             | wiersz sekcji         | `section`                         | B   | —                                                                                                            | S-01                        |
| item                   | Pozycja            | wiersz pozycji        | `item`                            | B   | —                                                                                                            | S-01/S-02                   |
| stage                  | Etap               | „etapy"               | `stage`                           | B   | `KosztorysEtapTotals` (`kosztorys-etap-totals.tsx`), `orphaned-etap-tag.db.test.ts`                          | S-04                        |
| stage deposit          | Zaliczka (na etap) | —                     | `stageDeposit` / `depositByStage` | B   | `zaliczki`, `ZaliczkaRowT`, `sumZaliczkiByStage`, `zaliczkiByStage`, `zaliczkiTotal`, `fetchZaliczkiByStage` | `lib/kosztorys/zaliczki.ts` |
| summary block          | Podsumowanie       | „Podsumowanie"        | `summary`                         | B   | — (resolved 2026-07-20)                                                                                      | `kosztorys-summary.tsx`     |
| combined R+M           | Łącznie            | „Łącznie"             | `combined`                        | B   | — (resolved 2026-07-20)                                                                                      | `summary-economics.ts:37`   |
| planned qty            | Przedmiar          | „Przedmiar" (N)       | `przedmiar`                       | A   | —                                                                                                            | S-01                        |
| stage-sum qty          | Pomiar z natury    | „Pomiar z natury" (O) | `pomiar`                          | A   | —                                                                                                            | S-01                        |
| unit price (client)    | Cena j.m.          | „Cena j.m." (Q)       | `unitPrice`                       | B   | —                                                                                                            | S-02                        |
| net value              | Wartość netto      | „Wartość netto" (T)   | `netValue`                        | B   | —                                                                                                            | S-02                        |

**`zaliczki` is the worst offender** — it's the same concept as `wplaty` (both **deposit**) split into
a _second_ Polish word, so kosztorys drifts against itself, and its own file (`lib/kosztorys/zaliczki.ts`)
imports `isDepositType` while naming its exports `Zaliczka*`. Canonical is `deposit`, already the word
its dependency uses. See EX-548's worked example.

**`etap` — ruled `stage` (2026-07-20), NOT a proper noun.** It was listed `A` on the "the sheet says
etapy" reflex, but `stage` is already the code's dominant word (`stage*` outnumbers `etap`-identifiers
~15:1 — `stageId`, `kosztorysStage`, the `stage-progress` collection). A concept with a clean English
equivalent already in use fails the Category-A test, whatever the sheet calls it. Drift left to rename:
`KosztorysEtapTotals` / `kosztorys-etap-totals.tsx` → `…StageTotals`, and the `orphaned-etap-tag` test
file. Polish stays in UI labels („Usuń etap", „Bez etapu") and prose.

**`podsumowanie` — ruled `summary` (2026-07-20), NOT a proper noun.** Same test as `etap`: naming the
sheet's specific „Podsumowanie" block is not enough when `summary` is a clean English equivalent.
Renamed: `computePodsumowanie` → `computeSummary`, `PodsumowanieT` → `SummaryT`,
`KosztorysPodsumowanie` → `KosztorysSummary`, `kosztorys-podsumowanie.tsx` → `kosztorys-summary.tsx`.

**`lacznie` — ruled `combined` (2026-07-20).** Not `total`: `totalNet` already denotes the _executed_
total in `use-kosztorys-editor.ts`, and „Łącznie" is the Robocizna+Materiały combination — a different
figure. `combined` / `combinedNet` keeps them distinguishable. This row was missing from the glossary
entirely; it surfaced only because `computeSummary` returned a half-renamed `{ laborCosts, lacznie }`.

---

## 3. DB-column guardrail

Canonical identifiers that map to a **real shared Postgres column** on prod data (`balance`, `margin`
on transfers/investments) — a **symbol** rename is safe; a **column** rename is a separate, careful
step and is **out of scope** until explicitly decided. Kosztorys columns are throwaway pre-dogfooding
(AGENTS.md) so their renames carry no data cost.

## Related documents

- **`01-domain-distillation.md`** — the DDD distillation this glossary sharpens; its KROK 1 is the
  descriptive backbone, this file adds the prescriptive canonical + drift columns.
- **EX-548** — the naming-drift finding and rename backlog; references this glossary as the spec.
- **`context/reference/kosztorys-editor-domain-notes.md`** — the sheet-column map and business prose;
  the register-mapping mandate there points here for the code↔UI translation.
- **AGENTS.md** › `Polish UI, English code` — the rule; its inline term list defers to this glossary.
