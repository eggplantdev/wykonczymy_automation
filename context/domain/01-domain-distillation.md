---
title: Domain Distillation — Wykonczymy
created: 2026-07-08
type: domain-distillation
---

# Domain Distillation — Wykonczymy

DDD distillation of the business domain from source documents **and** code. The
product is a **map of the domain**, not code. Every claim cites `file:line` that
was actually verified. Nothing is named that the sources don't name.

**Source keys (docs):** `prd` = `context/foundation/prd.md` · `shape` =
`context/foundation/shape-notes.md` · `road` = `context/foundation/roadmap.md` ·
`fin` = `context/foundation/investment-financials-and-discount.md` · `sync` =
`context/reference/kosztorys-sync.md`

**Method (10x_devs M4L5 — DDD legacy modernization):** this map + its follow-up refactors
were driven by the course prompts in `.claude/prompts/` — `m4l5-1-domain-distillation.md`
(this doc), `m4l5-2-invariant-aggregate-refactor.md` (the Kosztorys Item aggregate),
`m4l5-3-anti-corruption-layer.md` (the transfers↔kosztorys recon seam — the ACL that keeps
one concept from becoming two names, i.e. the EX-548 drift). Lesson write-up:
`~/workspace/10x_devs/lessons/m4/m4_l5_modernizacja-legacy-z-ddd-wydzielaj-domeny-potem-deleguj-agentowi.md`.

---

## KROK 0 — Project context

Business-management dashboard for a finishing/renovation company (kasy, transfery,
inwestycje, pracownicy). Stack: **Next.js App Router + Payload CMS on Postgres
(Neon prod / docker local)**. Polish UI, English code.

Where business logic lives (layers):

- **Domain entities** — Payload collections, `src/collections/*.ts`
- **Domain vocabulary / rules constants** — `src/lib/constants/transfers.ts`,
  `src/lib/constants/transfer-rules.ts`
- **Financial derivation (the real domain math)** — raw SQL in `src/lib/db/*`
- **Cross-field invariants** — Payload hook `src/hooks/transfers/validate.ts`
- **Mutations / authorization** — server actions `src/lib/actions/*`
- **UI** — `src/app/(frontend)`, `src/components`

Two phases of domain live here at once: the **existing** cash + investment-P&L
domain (mature, code-enforced) and the **incoming** in-app **kosztorys editor**
domain (specced in docs, largely not yet built). This distillation covers both
and flags which is which.

---

## KROK 1 — Ubiquitous Language

### Financial-core vocabulary (existing, code-backed)

| Term (domain)                             | Definition                                                                                                                        | Source (doc)    | Lives in code                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| **Transfer / Transakcja**                 | A cash movement between registers; the ledger row.                                                                                | fin:13          | `transfers.ts:52-56` (collection labelled "Transfer", **slug `transactions`**)        |
| **Kasa / Cash Register**                  | A money container; balance derived, never stored.                                                                                 | prd:229-232     | `cash-registers.ts:34`; types MAIN/AUXILIARY/VIRTUAL/WORKER `cash-registers.ts:77-82` |
| **Inwestycja / Investment**               | A job/project; unit financials + kosztorys attach to.                                                                             | fin:15-16       | `investments.ts:11`; status active/completed `investments.ts:5-8`                     |
| **source_register / target_register**     | Register a transfer leaves / enters.                                                                                              | fin:11-13       | `transfers.ts` fields; REGISTER_TRANSFER needs both `validate.ts:69-75`               |
| **Bilans inwestora**                      | The client's account (what they owe/are owed).                                                                                    | fin:16,57-58    | `calculate-balance.ts:6-9`                                                            |
| **Marża**                                 | Company profit, admin-only.                                                                                                       | fin:16          | `calculate-margin.ts:13-14`                                                           |
| **materiały**                             | Σ INVESTMENT_EXPENSE + Σ CORRECTION, excluding `settled`.                                                                         | fin:44-45       | `investment-financials.ts:41,50`                                                      |
| **robocizna (LABOR_COST)**                | What the company charges the investor for labour. **No source register** — not a cash movement.                                   | fin:18-20       | `calculate-margin.ts:14`; no-source rule `transfer-rules.ts:52-53`                    |
| **wypłaty (PAYOUT)**                      | Wages paid to a worker; lowers marża.                                                                                             | fin:48          | `calculate-margin.ts:14`                                                              |
| **wpłaty / income**                       | INVESTOR_DEPOSIT, COMPANY_FUNDING, OTHER_DEPOSIT.                                                                                 | fin:38-39       | `DEPOSIT_TYPES` `transfers.ts:58-62`                                                  |
| **korekta (CORRECTION)**                  | Accounting adjustment; folds into materiały; **may be negative** (invoice credit).                                                | fin:46-47       | sign rule `validation.ts:7-12`                                                        |
| **rabat (RABAT)**                         | Labour discount: company earns less, client owes less. Positive, no source register, requires investment.                         | fin:79,84-85    | `calculate-margin.ts:14`, `calculate-balance.ts`                                      |
| **strata (LOSS)**                         | Company-absorbed cost. Positive, investment optional; **never touches bilans**.                                                   | fin:80          | `calculate-margin.ts:5,14`                                                            |
| **settled flag ("Wliczone w robociznę")** | Material already priced into robocizna. Leaves register, lowers marża, off client bill. Valid on INVESTMENT_EXPENSE + CORRECTION. | fin:81          | `transfers.ts:228-239`; bucketing `investment-financials.ts:41,50`                    |
| **cancelled / CANCELLATION**              | Cancel = mark original `cancelled:true` + create linked CANCELLATION audit row.                                                   | fin (audit)     | `transfers.ts:206-226`; flow `actions/transfers.ts:217-237`                           |
| **Transfer-type union**                   | The 12-value core vocabulary.                                                                                                     | fin:36-42,79-80 | `TransferTypeT` `constants/transfers.ts:2-16`; labels `:18-31`                        |

### Kosztorys vocabulary (incoming — specced, largely not built)

| Term (domain)                 | Definition                                                                                    | Source (doc)          | Lives in code                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Kosztorys**                 | Per-investment line-item budget (sections, items, stages, totals).                            | prd:30-31             | slug `kosztoryses`, UI label **Kosztorys**, but code identifier `Sheets` / file `sheets.ts:13` (currently a Google-Sheet-id holder) |
| **Sekcja / Section**          | Per-investment renameable, orderable item grouping.                                           | prd:158-160           | **BRAK w kodzie** (S-01, not built)                                                                                                 |
| **Pozycja / Item**            | A line: description, unit, planned qty, measured qty, note.                                   | prd:162               | **BRAK w kodzie** (S-01/S-02)                                                                                                       |
| **Etap / Stage**              | Variable-count job stages with per-item progress.                                             | prd:173-174           | **BRAK w kodzie** (S-04)                                                                                                            |
| **Przedmiar / Pomiar**        | Planned qty / measured qty; two independent columns, value from pomiar.                       | road:137              | **BRAK w kodzie**                                                                                                                   |
| **Three price models**        | klient / podwykonawca z narzędziami / własne narzędzia — one dataset, three views.            | prd:168; road:162-163 | **BRAK w kodzie** (S-03)                                                                                                            |
| **clientPrice (snapshot)**    | The stored snapshot; subcontractor views computed from it.                                    | road:274              | **BRAK w kodzie**                                                                                                                   |
| **Markup coefficient**        | Global(investment)→section(nullable)→item override; derives subcontractor prices.             | road:267,274          | **BRAK w kodzie** (S-11)                                                                                                            |
| **Work catalogue / katalog**  | Master price list; items snapshot price at creation.                                          | prd:181-183           | **BRAK w kodzie** (S-06)                                                                                                            |
| **VAT rate (per investment)** | One rate per investment; netto entry, brutto computed.                                        | road:279              | **BRAK w kodzie** (S-12)                                                                                                            |
| **Pokój / Room**              | Per-investment room measurements. **CUT** — out of scope; `kosztorys_rooms` is a dead orphan. | road:186-188          | dead table only                                                                                                                     |

### Sync / integration vocabulary (transitional bridge)

| Term                 | Definition                                                                                  | Source                | Code                             |
| -------------------- | ------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- |
| **Materiały-mirror** | One-way CQRS mirror pushing active INVESTMENT_EXPENSE rows into the sheet (app→sheet only). | prd:33-34; sync:15-19 | `src/lib/actions/sheets-sync.ts` |
| **APP_MANAGED_TABS** | Three tabs: expenses / settled R+M / transfers.                                             | sync:30-34            | sync module                      |
| **Synchronizuj**     | Manual drift heal: append missing + heal present + scoped orphan removal.                   | sync:54-55            | sync module                      |

### Naming drift note (ubiquitous language ↔ schema disagree)

The persisted slugs contradict the domain word — a classic legacy tell:
`transactions` slug = "Transfer" aggregate (`transfers.ts:52-56`). For kosztorys the
UI label already reads **Kosztorys**, but the slug is `kosztoryses` and the code
identifier / file is `Sheets` / `sheets.ts:13` — the leftover Google-Sheets name.
Behavior-neutral, but the map must record it so future work isn't misled.

---

## KROK 2 — Subdomain classification

| Subdomain                                                                                                    | Class          | Justification (product goal ref)                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Investment financials / P&L** (marża, bilans, the 4 modifiers)                                             | **Core**       | The company's decision-making surface; must "behave identically" through the migration (FR-015; guardrails prd:107-113). Pre-existing, code-enforced core.             |
| **In-app kosztorys editor** (sections, items, 3 price models, stages, catalogue, live totals, VAT, discount) | **Core**       | The whole point of this phase — "move the kosztorys fully into the app and retire Google Sheets" (shape:64-65; north star road:51-54). The differentiator being built. |
| **Cash / transfer ledger** (registers, transfer types, balances)                                             | **Core**       | The financial substrate marża/bilans derive from; the financial-core E2E guards exactly this (prd:98-99).                                                              |
| **Work catalogue**                                                                                           | **Supporting** | Feeds item price snapshots; required at release but not the differentiator (prd:181-183).                                                                              |
| **Materiały-mirror / Google Sheets sync**                                                                    | **Supporting** | Transitional bridge on "death row" (sync:5-9); kept syncing during transition, torn down later (FR-014; Phase 3b).                                                     |
| **One-shot importer**                                                                                        | **Supporting** | Migrates live sheet data once; deferred, gates S-10 (road:80,365).                                                                                                     |
| **Leads / Facebook pipeline**                                                                                | **Supporting** | Adjacent business capability, not this phase's core.                                                                                                                   |
| **Auth / roles (ADMIN/OWNER/MANAGER/EMPLOYEE)**                                                              | **Generic**    | Standard RBAC (prd:282).                                                                                                                                               |
| **Test-automation / E2E harness**                                                                            | **Generic**    | "Infrastructure-only: no domain-logic change" (prd:277).                                                                                                               |

---

## KROK 3 — Aggregate candidates & their invariants

### A. Cash Register (balance)

- **Invariant:** balance is **computed on read, never stored** —
  deposits add, everything else subtracts, REGISTER_TRANSFER moves source→target,
  cancelled rows excluded. **ENFORCED** `sum-transfers.ts:31-48,62-90`; confirmed
  no write path `recalculate-balances.ts:17-18`.
- **Invariant:** cannot delete a register with referencing transactions.
  **ENFORCED** (throws with count) `cash-registers.ts:17-31`.
- **Invariant:** Managers may only create AUXILIARY registers. **ENFORCED**
  `cash-registers.ts:11-14`.
- **Non-invariant (deliberate):** a register is **allowed** to go negative — the
  sufficient-funds guard was dropped by **client decision**, not lost. Confirmed in
  git (dropped `76dd757`, flip-flopped 4×) and now marked intentional in-code
  (`validate-source-register.ts`). See KROK 4 #1.

### B. Investment (financials)

Single derivation `deriveFinancials` `investment-financials.ts:34-53`.

- **Bilans = wpłaty − (materiały + robocizna) + rabat.** **ENFORCED**
  `calculate-balance.ts:6-9`.
- **Marża = robocizna − wypłaty − rabat − strata − settled.** **ENFORCED**
  `calculate-margin.ts:13-14` (verified verbatim).
- **Plain materiały never enters marża** (pass-through cost billed to client).
  **ENFORCED** by construction — material terms simply absent from the marża
  formula (fin:63-68).
- **strata lowers marża, never bilans.** **ENFORCED** `calculate-margin.ts:5,14`;
  loss kept out of `buildFinancialFields` (fin:94-95).
- **settled excluded from materiały, subtracted from marża.** **ENFORCED**
  `investment-financials.ts:41,50`.

### C. Transfer (cross-field consistency)

Guardian hook `validate.ts`:

- CANCELLATION requires `cancelledTransaction` `validate.ts:33-38`.
- **CORRECTION must be negative; all others positive** `validate.ts:47-51` →
  `validation.ts:7-12`.
- source_register required unless type is LABOR_COST/RABAT/LOSS (auto-cleared)
  `validate.ts:54-61`, `transfer-rules.ts:52-53`.
- investment required for INVESTOR_DEPOSIT/INVESTMENT_EXPENSE/LABOR_COST/RABAT
  `validate.ts:64-66`.
- REGISTER_TRANSFER: target required, must differ from source `validate.ts:69-75`.
- OTHER→otherCategory; PAYOUT→worker `validate.ts:78-90`.
- settled auto-cleared unless expenses-tab type `validate.ts:95-97`.

### D. Transfer (mutation authorization)

- Cannot edit an already-cancelled transfer or a CANCELLATION row
  `actions/transfers.ts:182-183`.
- **Only LABOR_COST amounts are editable**; other amount edits silently dropped
  `actions/transfers.ts:271-273`; reinforced by field access
  `transfers.ts:85,111`. Amount edits audited into `amount-edits`
  `actions/transfers.ts:286-296`.

### E. Kosztorys item (incoming invariant — specced, not built)

- **Worth is computed, never stored = quantity × snapshotted price.** All totals
  derived. Spec prd:263-266; road:137. **BRAK w kodzie** — the item table doesn't
  exist yet.
- **Price snapshot immutability:** catalogue price change affects only items
  created afterwards. Spec prd:264-265,271-272. **BRAK w kodzie**.

---

## KROK 4 — MODEL vs CODE drift

| #   | Document / model says                                                               | Code does                                                                                                                                                   | Evidence                                                                    | Severity                                   |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | (Superseded) An earlier model read "register must not go negative" as an invariant. | **Intentional:** registers may go negative by **client decision**; the guard was removed deliberately, not lost, and is now marked so in-code. Not a drift. | git `76dd757` (drop), EX-410 (canceled); `validate-source-register.ts` note | None — **intentional**, documented in-code |
| 2   | Payment methods available to users.                                                 | Collection offers CASH/BLIK/TRANSFER/CARD; app enables **only CASH** (rest commented). Admin-panel row can carry a method app forms never surface.          | `transfers.ts:43-48` vs `constants/transfers.ts:124-137`                    | Medium                                     |
| 3   | Corrections now route to the expenses tab.                                          | Retired `CORRECTION_MOVED_LABEL` + CORRECTION slot in `TRANSFERS_SUMMARY_TYPES` kept as frozen placeholders (to avoid shifting sheet formulas).             | `constants/transfers.ts:104-122`                                            | Low — **intentional**, documented in-code  |
| 4   | Domain words: "Transfer", "Kosztorys".                                              | Slugs `transactions`, `kosztoryses`; kosztorys UI label is Kosztorys but the code identifier / file is `Sheets` / `sheets.ts`.                              | `transfers.ts:52-56`; `sheets.ts:13`                                        | Low — naming only                          |
| 5   | Kosztorys item worth = qty × snapshot; sections/items/stages/catalogue.             | None of the item/section/stage/catalogue tables exist yet.                                                                                                  | prd:263-266; `sheets.ts:13` is a sheet-id holder                            | Expected — greenfield of this phase        |

**Anti-drift guards that already exist** (strengths worth preserving): compile-time
check that every union member has a Payload option `transfers.ts:37-41`; shared
single-source membership arrays (`transfer-rules.ts:22-24`,
`constants/transfers.ts:95-101`) keep settled/tab-routing rules from diverging.

---

## KROK 5 — Refactor ranking

Ranked by **value** (how core the invariant) × **risk** (how weakly enforced today).

1. **#1 — Kosztorys Item aggregate (compute-not-store worth + snapshot immutability).**
   Core to the whole phase, and today entirely unenforced because unbuilt. High
   value; risk is "greenfield," so it's about _building the invariant in from the
   start_ (worth derived, price snapshotted at creation) rather than fixing drift.
   This is S-01/S-02/S-06 territory.

2. **#2 — Reconcile payment-method divergence (drift #2).** Lower value (mostly a
   consistency/UX correctness issue), moderate risk. Decide whether the extra
   methods are real domain concepts or dead options, then converge the two lists.

Drift #1, #3 and #4 are **not** refactor targets — #1 is an intentional client
decision (negative balances allowed; EX-410 opened to "restore" it and canceled),
#3 is intentional and documented, #4 is cosmetic naming a migration isn't worth.

---

## Summary

This artifact maps two coexisting domains in Wykonczymy: a mature, code-enforced
**cash-ledger + investment-P&L** core (marża/bilans and the four modifiers —
korekta, rabat, strata, settled — each verified against `calculate-margin.ts` and
`calculate-balance.ts`), and an **incoming in-app kosztorys editor** that the docs
specify in full but the code has barely started (`kosztoryses` is still just a
Google-Sheet-id holder). The strongest domain rules — balance-computed-on-read,
CORRECTION-must-be-negative, robocizna-has-no-source-register, strata-never-touches-bilans,
only-LABOR*COST-amounts-editable — are genuinely enforced in code, and the codebase
even has anti-drift guards (compile-time union coverage, shared membership arrays).
One finding first read as the headline — a dropped negative-balance guard — turned
out on git investigation to be an **intentional client decision** (registers are
allowed to go negative), not a silent loss; EX-410 was opened to "restore" it and
correctly **canceled**. That leaves the top refactor target as the **incoming
Kosztorys Item aggregate** — building worth-is-computed and price-snapshot
immutability in from the start, before the kosztorys editor piles new surface area
onto the ledger. Cautionary note for future passes: a commented-out guard is a
\_candidate* finding, not a verdict — confirm intent in git before ranking it.
