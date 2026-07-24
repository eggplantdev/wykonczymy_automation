---
title: Domain Distillation — Wykonczymy
created: 2026-07-20
supersedes: 2026-07-08 revision (pre-kosztorys-v2 build)
type: domain-distillation
---

# Domain Distillation — Wykonczymy

DDD distillation of the business domain from **code first** (source docs are a
hint, the code is the authority). The product is a **map of the domain**, not
code. Every claim cites `file:line` that was actually verified on commit
`2562a2e1` (branch `staging`). Nothing is named that the code doesn't name.

**Why this is a from-scratch regeneration, not a patch.** The 2026-07-08 revision
predates the kosztorys v2 build (S-01…S-10). Its central claim — "Kosztorys item
aggregate — **BRAK w kodzie**", ranked #1 refactor as greenfield — is now dead:
the aggregate is built and its headline invariants are enforced by construction.
Regenerating rather than patching is gate #3 of the `kosztorys-terminology` slice
(`context/changes/kosztorys-terminology/change.md`).

**Method (10x_devs M4L5 — DDD legacy modernization):** driven by the course
prompts in `.claude/prompts/` — `m4l5-1-domain-distillation.md` (this doc),
`m4l5-2-invariant-aggregate-refactor.md` (the Kosztorys Item aggregate),
`m4l5-3-anti-corruption-layer.md` (the transfers↔kosztorys recon seam). The three
map onto the four-slice arc **terminologia → niezmienniki → agregat → ACL**.
Lesson write-up:
`~/workspace/10x_devs/lessons/m4/m4_l5_modernizacja-legacy-z-ddd-wydzielaj-domeny-potem-deleguj-agentowi.md`.

---

## KROK 0 — Project context

Business-management dashboard for a finishing/renovation company (kasy, transfery,
inwestycje, pracownicy). Stack: **Next.js App Router + Payload CMS on Postgres**
(Neon prod / docker local). **Polish UI, English code** (`AGENTS.md`).

Layer map:

- **Domain entities** = Payload collections (`src/collections/*.ts`).
- **Financial derivation** = raw SQL + pure derive fns (`src/lib/db/*`).
- **Kosztorys domain logic** = pure-function layer `src/lib/kosztorys/*` — **new
  since the last distillation**, the phase's differentiator.
- **Mutations** = server actions via `protectedAction` (`src/lib/actions/*`).
- **Cross-field transfer invariants** = Payload hook `src/hooks/transfers/validate.ts`.
- **Editor state** = `src/components/kosztorys/use-kosztorys-editor.ts`.

**Headline change vs 2026-07-08:** the kosztorys editor is BUILT. Collections
`kosztorys-sections.ts`, `kosztorys-items.ts`, `kosztorys-stages.ts`,
`stage-progress.ts` exist; slices S-01…S-10 mostly `done` (`roadmap.md:279,297,310,322,334,356,360,400,417`);
S-11 bridge `in review`, S-12 recon `implementing` (`roadmap.md:452,471`).

---

## KROK 1 — Ubiquitous Language

New/changed terms since the last map. The financial-core vocabulary
(bilans/marża/balance-on-read/no-source-register triple) was re-verified against
code and is **unchanged** — see KROK 3B/C/D for the citations.

| Term                                                                         | Definition                                                                                                                                              | Lives in code                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Kosztorys**                                                                | Per-investment budget; separate row linkable pre-investment, 1:1 via partial unique index                                                               | `src/collections/sheets.ts:12-14` (slug `kosztoryses`, type `Sheets`), cardinality `sheets.ts:10-11`                         |
| **Sekcja**                                                                   | Renameable, orderable item grouping; carries `defaultCostVariant` + per-section coeff overrides (null = inherit global)                                 | `kosztorys-sections.ts:29-51`                                                                                                |
| **Pozycja (item)**                                                           | Line: description, unit, `plannedQty`, `discountType/Value`, `clientPrice`, per-item subcontractor override pair, `costVariant`, `hiddenInExport`, note | `kosztorys-items.ts:32-49`                                                                                                   |
| **Przedmiar** (`plannedQty`)                                                 | Hand-typed offered scope; offer figure = `rowPlannedNetForView` (sheet S = N×Q−rabat)                                                                   | `kosztorys-items.ts:38`; `calc.ts:88-90`                                                                                     |
| **Pomiar z natury**                                                          | **Not stored — IS the stage sum** (sheet O = SUM(D:M)); `rowTotalQtyDone`                                                                               | `settlement.ts:71-74`; item comment `kosztorys-items.ts:7-9`; drop migration `20260716_0_drop_kosztorys_measured_qty.ts:4-8` |
| **Etap (stage)**                                                             | Dynamic shared column: ordinal + optional label per investment                                                                                          | `kosztorys-stages.ts:29-33`                                                                                                  |
| **Stage progress**                                                           | Sparse qtyDone per (item, stage); missing row = 0; upsert via SQL ON CONFLICT                                                                           | `stage-progress.ts:5-6,28-32`; `actions/kosztorys.ts:467-472`                                                                |
| **Price views**                                                              | One dataset → three views: `client` / `w_tools` / `own_tools`; subcontractor price = clientPrice × effective coeff (item override > section > global)   | `calc.ts:36-56`; global coeffs `investments.ts:80-97`                                                                        |
| **clientPrice snapshot**                                                     | Stored per item; nothing recomputes it from a catalog — the catalog doesn't exist (autocomplete deferred, `roadmap.md:598`)                             | `kosztorys-items.ts:5,41`                                                                                                    |
| **Rabat (per-item)**                                                         | `discountType` percent/amount; (type,value) consistency kept by transition fns                                                                          | `calc.ts:25-33`; `discount-edit.ts:14-27`                                                                                    |
| **Rabat globalny**                                                           | Per-investment; overrides per-item rabat (rows go gross), subtracted once off the executed total; active iff known mode AND value>0                     | `investments.ts:109-119`; `calc.ts:21-33,169-173`                                                                            |
| **VAT**                                                                      | Single per-investment fraction; brutto = render transform on POST-discount net; **prace-only** (materiały/wpłaty at face value)                         | `investments.ts:98-105`; `calc.ts:63-65`; `summary-economics.ts:11-16,52-57`                                                 |
| **Wartość netto (T)**                                                        | Executed value = `netForQtyForView(row, Σstages, view)` — computed on read, never stored                                                                | `settlement.ts:88-94`                                                                                                        |
| **Pozostało**                                                                | Anchored to przedmiar (S), not T — deliberate parity break with the sheet's dead AF column; null when no przedmiar; may go negative                     | `settlement.ts:97-114`                                                                                                       |
| **Suma prac wykonanych** (pre-rabat) / doneNet (post-rabat) / rabatClientNet | The client-view triple both recon surfaces share via one code path                                                                                      | `settlement.ts:16-69`                                                                                                        |
| **Reconciliation (the scream)**                                              | Kosztorys client-view net vs Σ LABOR_COST / Σ RABAT; mismatch at ≥1 grosz; read-only verdict, never a write                                             | `reconciliation.ts:34-76`                                                                                                    |
| **Zaliczka**                                                                 | Etap-tagged deposit; Σ per stage, untagged excluded                                                                                                     | `zaliczki.ts:13-20`; SQL feed `sum-transfers.ts:256-275`; tag-validation `hooks/transfers/validate.ts:115-122`               |
| **Podsumowanie / Łącznie**                                                   | Robocizna + Materiały = Łącznie with udział; „Do zapłaty R+M" = robocizna − wpłaty + materiały (= −Bilans on R+M base)                                  | `summary-economics.ts:45-78`                                                                                                 |
| **Snapshot (auto/manual)**                                                   | Raw `kosztorys_snapshots` table (no Payload collection); auto keep-50/7-day, manual 365-day                                                             | `src/lib/db/snapshots.ts:11-20`                                                                                              |
| **Delete plan**                                                              | blocked / cascade-section / remove-item + `requiresConfirm`                                                                                             | `delete-policy.ts:28-61`                                                                                                     |

---

## KROK 2 — Subdomains

| Subdomain                                                   | Class                     | Justification                                                                                      |
| ----------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| Kosztorys editor domain (`lib/kosztorys/*` + 4 collections) | **Core**                  | The phase's differentiator, now BUILT; roadmap bands 2–3 orbit it                                  |
| Investment P&L (marża/bilans + 4 modifiers)                 | **Core**                  | Decision surface; FR-015 firewall; unchanged since last map                                        |
| Cash/transfer ledger                                        | **Core**                  | Substrate for the P&L; balances computed on read                                                   |
| **Recon seam (kosztorys ↔ transactions)**                   | **Core (new)**            | S-11/S-12 — the instrument gating the future source flip of robocizna/rabat (`roadmap.md:456-471`) |
| Snapshot/undo/version system (S-07)                         | Supporting                | Safety net for the core editor, no business rule of its own                                        |
| Presets / seed / import scripts                             | Supporting                | Bootstrap convenience                                                                              |
| Google Sheets sync (v1 mirror)                              | Supporting, **death row** | `roadmap.md:448`: "v1 mechanisms … obsolete and are never rebuilt"                                 |
| Leads/FB pipeline                                           | Supporting                | Adjacent                                                                                           |
| Auth/RBAC, E2E harness                                      | Generic                   | Standard                                                                                           |

---

## KROK 3 — Aggregates & invariants

### A. Kosztorys Item aggregate (was "BRAK w kodzie" — now built and largely ENFORCED)

- **Worth computed on read, never stored** — no value/worth column on
  `kosztorys-items.ts:32-49`; all money figures are pure fns over persisted
  inputs (`calc.ts:4-6` "we persist only the inputs and compute everything live").
  **ENFORCED by construction.**
- **Pomiar IS Σ stages (EX-489/EX-494)** — `measured_qty` dropped
  (`20260716_0_drop_kosztorys_measured_qty.ts:9-13`); `rowTotalQtyDone` = reduce
  over stage keys (`settlement.ts:72-74`); no other quantity branch
  (`settlement.ts:78-87`). **ENFORCED.** Intent: **DECISION** (migration cites
  EX-494/EX-489; commit `c09fbcf1`).
- **Price snapshot at creation** — `clientPrice` is a stored per-item number
  (`kosztorys-items.ts:5,41`); nothing links it to a live catalog because **the
  catalog was never built** (autocomplete deferred, `roadmap.md:598`).
  Immutability-vs-catalog is **VACUOUSLY ENFORCED** — snapshot semantics exist
  only as a comment; there is no second price source to drift from. Intent:
  DECISION (owner deferral), not a gap.
- **Global discount overrides per-item rabat (never deletes it)** —
  `calc.ts:26-32` short-circuits before reading `discountType`; per-item fields
  stay persisted. **ENFORCED**; matches ruling "override≠delete".
- **Stage values sum to row value** — share-of-net formula (`calc.ts:115-126`),
  `stageTotalsForView` uses the same primitive (`settlement.ts:138-157`).
  **ENFORCED by construction** (+ asserted in `kosztorys-calc.test.ts`, `calc.ts:110`).
- **Item's investment FK = its section's investment** — derived server-side from
  the section, never caller-passed (`actions/kosztorys.ts:233-242,286-292`).
  **ENFORCED.**
- **≥1 item in the kosztorys (floor)** — **CLIENT-ONLY** (`delete-policy.ts:44-45`);
  `removeItemAction` (`actions/kosztorys.ts:327-345`) has no server floor check.
  Gap class: weak enforcement → KROK 5 #1.
- **Populated delete requires confirm + auto-snapshot** — snapshot capture is
  server-enforced on every item/section/stage delete
  (`actions/kosztorys.ts:210-218,332-340,433-441`); the confirm is UI-only by
  design (EX-477, commit `5908fb8a`). Intent: **DECISION** — the old hard-block
  was deliberately relaxed.
- **Insert-at-order atomicity** — shift+create in one transaction (EX-464)
  `actions/kosztorys.ts:293-320`. **ENFORCED.**

### B. Investment financials — all five invariants re-verified unchanged

- Bilans = income − (materials + labor) + rabat: `calculate-balance.ts:6-9`. **ENFORCED.**
- Marża = laborCosts − payouts − rabat − loss − settled: `calculate-margin.ts:13-14`. **ENFORCED.**
- strata never touches bilans; settled excluded from materiały, subtracted from
  marża: `investment-financials.ts:41,50`; loss absent from `calculate-balance.ts`. **ENFORCED.**

### C. Cash Register — balance computed on read (`sum-transfers.ts:30-59,65-106`), cancelled excluded everywhere. **ENFORCED.** Negative balance **allowed** — intentional (git `76dd757`, EX-410 canceled) → non-target.

### D. Transfer cross-field consistency — hook intact

CANCELLATION link `validate.ts:42`; CORRECTION-negative `validate.ts:55`;
no-source triple `validate.ts:61-68` + `transfer-rules.ts:53`; investment-required

- auto-clear `validate.ts:71-81`; REGISTER_TRANSFER target≠source `validate.ts:84-91`;
  **new since last map:** `kosztorysStage` tag cleared when the transfer changes
  investment; deliberately NOT a membership check (read path is investment-scoped,
  foreign tag renders „Bez etapu") `validate.ts:115-122`. **ENFORCED.**

### E. Recon seam (kosztorys ↔ transactions) — **intentional NON-invariant**

`buildKosztorysReconciliation` only returns `{expected, actual, mismatch}`
(`reconciliation.ts:66-76`) — it screams, never blocks or writes. Intent confirmed
in `roadmap.md:456-471`: robocizna=Σ LABOR_COST equality becomes authoritative
only after an explicit per-investment "verified/populated" flag (not yet built);
kosztorys is deliberately disconnected from marża (parked P5, `roadmap.md:447`
FR-015 write firewall). **Do not harden.**

---

## KROK 4 — MODEL-vs-CODE drift

| #   | Doc/model says                                                                                        | Code does                                                                                                                                                                                                                                                                        | Evidence                                                    | Severity                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | **Old distillation:** "Kosztorys item aggregate — BRAK w kodzie / greenfield"; #1 refactor = build it | Fully built and enforced (KROK 3A)                                                                                                                                                                                                                                               | old doc vs `kosztorys-items.ts`, `calc.ts`, `settlement.ts` | **High — the doc being regenerated is the drift**           |
| 2   | `kosztorys-stages.ts:6-7`: "Deleting a stage that has recorded progress is **blocked**"               | EX-477: allowed behind confirm + auto-snapshot                                                                                                                                                                                                                                   | `actions/kosztorys.ts:426-446`; commit `5908fb8a`           | Low — stale comment, change intentional                     |
| 3   | Glossary marks `rabat*`, `zaliczki*`, `wplaty*` drift pending rename (EX-548)                         | Still live: `rabatClientNet` `settlement.ts:28`; `Zaliczka*`/`sumZaliczkiByStage` `zaliczki.ts:5-13`; `wplatyNet`, `materialyNet` params `summary-economics.ts:70-71,48` — latter two are rule-3 "half-translated" violations; `materialyNet` isn't in the glossary drift column | `02-glossary.md:49,113`; AGENTS.md naming rule 3            | Medium — tracked (EX-548), but `materialyNet` untracked     |
| 4   | Sheet parity: AF = T − Σ(V:AE)                                                                        | „Pozostało" anchors to S (przedmiar) — AF is identically zero under pomiar=Σstages                                                                                                                                                                                               | `settlement.ts:97-105`                                      | None — documented decision                                  |
| 5   | `delete-policy.ts:5-6`: "Server SQL stays the authority" for the populated pre-check                  | For the **populated** check the server no longer blocks (EX-477); for the **≥1-item floor** there is no server authority — client-only                                                                                                                                           | `delete-policy.ts:44-45`; `actions/kosztorys.ts:327-345`    | Medium — see KROK 5 #1                                      |
| 6   | S-12 `change.md` says kosztorys recon side read gross                                                 | Code compares netto↔netto                                                                                                                                                                                                                                                        | `reconciliation.ts:4-7`; `roadmap.md:471`                   | Low — already flagged, EX-536/EX-539 open                   |
| 7   | Old doc: kosztorys = "Google-Sheet-id holder"                                                         | `kosztoryses` still holds `googleSheetId` **required+unique** (`sheets.ts:44-50`) while v1 sync is "obsolete, never rebuilt" (`roadmap.md:448`)                                                                                                                                  | `sheets.ts:44-50`                                           | Medium — legacy field load-bearing for nothing on death row |

---

## KROK 5 — Refactor ranking

1. **#1 — Server-enforce the Kosztorys-tree structural floor (the "≥1 item"
   invariant) — coreness high × enforcement weakest.** `REMOVE_BLOCK_LAST_ITEM`
   lives only in `delete-policy.ts:44-45` (client) + tests;
   `removeItemAction`/`removeSectionAction` (`actions/kosztorys.ts:205-223,327-345`)
   will delete the last item or every section from a stale tab / double fire /
   direct action call, leaving the empty-kosztorys state the seed dialog prevents.
   Every OTHER kosztorys invariant is pure-function-by-construction or server-side;
   this one trusts the browser. Cheap fix (one guard per action), no behavior
   change for honest clients. **Accidental gap** — git shows EX-477 relaxed the
   _populated_ block, no trace of a decision to leave the _floor_ client-only.
2. **#2 — Retire/relax `googleSheetId` required+unique on `kosztoryses`** (drift
   #7): the identity of the core aggregate is still a dead integration's key;
   blocks nothing today but couples every new kosztorys to a Sheet that S-19
   cutover deletes. Sequencing question, not urgent.
3. **#3 — Finish the EX-548 rename tail** (`rabatClientNet`, `Zaliczka*`,
   `wplatyNet`, + add untracked `materialyNet` to the glossary): pure
   language-hygiene, already-tracked; low risk, low value per edit, but it is the
   glossary's cardinal-sin class. **This is the `kosztorys-terminology` slice.**

**Intentional non-targets** (confirmed, excluded): negative register balance (git
`76dd757`, EX-410 canceled); kosztorys↔marża disconnect + recon-seam non-invariant
(`roadmap.md:447,456-471`, P5 parked); populated-delete relaxation (EX-477,
`5908fb8a`); pomiar-as-stage-sum parity break on „Pozostało" (`settlement.ts:99-105`).

---

## Bottom line

The 2026-07-08 distillation's central claim is dead: the Kosztorys Item aggregate
is built and its two headline invariants — worth-computed-never-stored and
pomiar-IS-the-stage-sum — are enforced by construction in a pure-function domain
layer (`calc.ts` pricing, `settlement.ts` quantities) over four thin Payload
collections. The financial core (bilans/marża formulas, balance-on-read, the
transfer validate hook) is byte-for-byte the same enforced core as before, and a
new Core subdomain has appeared: the read-only reconciliation seam that compares
kosztorys client-view figures against Σ LABOR_COST/Σ RABAT and deliberately only
screams, because the source flip is gated on a not-yet-built per-investment
"verified" flag. The weakest enforcement point in the whole map is now structural,
not financial: the "kosztorys keeps ≥1 item" floor exists only client-side while
every server delete action is unguarded — the #1 refactor. Naming drift persists
exactly where the glossary says (plus one untracked `materialyNet`), and
`kosztoryses` still requires a `googleSheetId` for an integration on death row.
Everything else that looks dropped (negative balances, populated deletes, the
marża disconnect) is a verified owner decision, not a gap.
