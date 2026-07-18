# Kosztorys parity gaps — capture & triage

**Purpose:** collect every feature that exists in the owner's original Kosztoryses (the Google
Sheet — the domain authority) but is **missing from the in-app editor**, plus anything else the
editor still can't do. This is a _capture_ doc: dump freely here, we triage into slices / Linear
tasks afterward. It is **not** a plan.

**Spec source:** the canonical reference arkusz + offer-view screenshots (AGENTS.md → "The Owner's
Reference Sheet"), **and** the real/varied client sheets. Sheet vocabulary throughout — „Przedmiar",
„Pomiar z natury", etapy, „Cena j.m.", rabat, „Wartość netto przedmiar", „Podsumowanie", „% udziału".

**How to use:** add rows under **Owner braindump** — one line per missing thing, however rough. Don't
worry about duplicates or wording; triage dedupes. The audit lenses fill their sections. Then we build
the **Consolidated gap table** and assign each row a disposition.

**Guiding principle:** capture the **capability**, never a v1 **mechanism**. v1 is Sheet-backed, so it
carries workarounds — „Synchronizuj" sync, the `INVESTMENT_EXPENSE` mirror, the iframe — that exist only
because data lived in Google. v2 is native DB: those are **obsolete**. Want the outcome (kosztorys reflects
materiały live), not the plumbing.

---

## Owner braindump

_Add anything you know is missing. Rough is fine — name + a word on where it lives in the sheet._

- **Kosztorys reflects investment materiały live** — the _capability_ behind v1's `INVESTMENT_EXPENSE`
  mirror. v2 is native DB, so this is a **live join, not a sync**. ⚠️ capture the capability, **not** the
  v1 mechanism — the „Synchronizuj" button, the mirror, the iframe are Sheet-backed workarounds and are
  **obsolete** (delete from the mental model). v2 was deliberately disconnected from marża (owner P5) —
  decide later what un-parks. _(Lens 4 mapping v1 wiring to separate capability from workaround.)_
- **Footer „aktualnie do zapłaty R + M" total** _(owner, `context/reference/kosztorys-sheet/footer-total-r-plus-m.png`, rows 456–464)_ — the sheet wires
  **robocizna** (suma transzy → wartość netto @ VAT) **+ materiały** (Pozostałe koszty + Materiały
  wykończeniowe + Materiały budowlane) into one „do zapłaty" figure, netto + brutto. The app must show this
  R+M total natively. = Lens 1 gap B + Lens 4 financial-plane capability (materiały side is live-join, not sync).
- **Pie „% udziału" per sekcja** _(same screenshot)_ — offer-view viz (Łazienka 38%, Ściany i sufity 31.3%…);
  app has the data in a tooltip only. = Lens 1 gap #8.
- …

---

## Audit findings

_(filled by the discovery pass — three read-only lenses, running now)_

### Lens 1 — Sheet-vs-app parity

The app reproduces the **per-row engine** (`S`, `T`, `V–AE`, `AF`) and **section subtotals** faithfully.
Three whole regions of the sheet have **no** app representation:

**A. Oferta / eksport — the client-facing offer view + PDF (largest single gap).** `hiddenInExport` is
stored + mutable per pozycja (`kosztorys-items.ts:47`) but **nothing consumes it** — no offer render,
no filtered view, no PDF (`buildPrintHtml`/`printViaIframe` exist only for _transfers_). Both offer-view
screenshots (hidden rows/cols, summary block, pie) have zero app equivalent.

**B. Footer R+M / materiały / zaliczka block (sheet rows 456–464)** — the "kosztorys absorbs whole-investment
cost" target. App's totals bar is robocizna-only. Missing:

- **Materiały budowlane / wykończeniowe / Pozostałe koszty** (actuals pulled from the `wydatki` tab) — `T458/T459/T460`.
- **Zaliczka** (advance, from `transfery`) — `V459`.
- **aktualnie do zapłaty R + M netto/brutto** — `T461/T462` (combines the above).
  → this is the **same territory as Lens 4 v1-wiring** (INVESTMENT_EXPENSE materiały). v2-disconnected-by-design.

**C. `Podsumowanie` split + per-tranche totals.** Robocizna-vs-Materiały split (`B6=T395`, `B7=T398`) and
the **suma transzy** per-etap column totals (`V457:AE457 = SUM(V5:V455)…`) — app sums rows + sections but
**never the stage axis**. (Same cluster as OQ12a/b.)

**Full gap table (12 rows):** offer/export (real, biggest) · Podsumowanie R/M split (owner-decision) ·
materiały actuals (real+decision) · R+M do zapłaty (real, depends on materiały) · zaliczka (real+decision) ·
suma transzy per-etap (real+decision: client vs subcontractor price) · R netto/brutto suma wykonanych
(trivial readout) · **pie chart % udziału** (viz — data exists in a tooltip only) · udział% base semantics
(sheet weights on `S`/Przedmiar, app on executed `T` — owner-decision) · **pokoje** metraż tab (real, owner
P1-optional) · zakres z/bez narzędzi as standalone catalogues (real, deferred `work_catalogue`) · plan-vs-actual
panel (real, P5-linkage).

Full dump: `scratchpad/sheet.txt`. Key files: `calc.ts`, `settlement.ts`, `kosztorys-totals-bar.tsx`,
`kosztorys-section-summary.tsx`, `kosztorys-items.ts`.

### Lens 2 — Dogfooding-log mining

**Genuinely uncaptured (no S-01…S-16 slice):**

- **Brutto column placement** — renders far-right, owner must scroll; repeatedly parked, no sheet parity to copy (§8/§11).
- **Kwota↔procent toggle + procent wykonania** (per item AND per stage) — **filed EX-479**, parked pre-code.
- **`O komentarz` column** — sheet has a per-item comment column the app lacks (§11); we carry one `Netto` where the sheet has `P–U etapy (wartość)`.
- **`Podsumowanie` % udziału + R/M/Łącznie split** — same as Lens 3 / OQ12a.
- **Per-etap value total** — same as OQ12b (owner-gated).

**Parked dsg/grid rendering bugs (no slice owns them; would fall to S-15 hardening / S-13 E2E):**

- Delete-repaint flicker (§6, cosmetic) · latent column-resize `guideX` containing-block bug (§3) · **live 🔴 intermittent column-resize failure (EX-422, In Progress)** · never-reproduced stage-header rename regression (§10, under EX-422) · no automated tests over EX-422 view/stage behaviour.

**Already resolved / not gaps:** add-item discoverability thread (§2/§2a–c → settled by the ⋯ menu, EX-436); `Wartość przedmiaru` netto/brutto column (§13 — built + tested, hand-verify owed); settings-home relocation (EX-478).

**Themes:** (1) add-item UX — resolved; (2) a cluster of parked grid-render bugs riding under EX-422/S-15; (3) genuinely uncaptured domain/presentation features — Brutto placement, EX-479 toggle, `O komentarz`, Podsumowanie split, per-etap total.

### Lens 4 — v1 app↔kosztorys wiring

v1 pushes the investment's **entire** financial picture (not just materiały) into 3 protected sheet tabs,
kept live by transfer-mutation hooks. Split by the guiding principle:

**Obsolete mechanism (do NOT rebuild — Sheet-backed plumbing):** sheet identity/link/unlink lifecycle ·
iframe „Otwórz" view (superseded by the v2 grid) · „Synchronizuj" preview+push · per-transfer auto-mirror
hooks · post-link auto-populate · Google tab provisioning/reset/protection/SUMIF blocks · sheet→investments
cache coupling. Files: `sheets.ts`, `sheets-sync.ts`, `hooks/transfers/sync-sheet.ts`, `google/app-managed-tabs.ts`.

**Capability to keep (the real gap — one linkage, all parked-by-decision, NO slice yet):**

- **v2 editor connected to the investment financial plane** — materiały (`INVESTMENT_EXPENSE`+`CORRECTION`),
  robocizna (`LABOR_COST`), wpłaty/wypłaty/rabat/strata, settled R+M. Today v2 is firewalled off
  (FR-015; a rabat typed in v2 never touches marża). This is the **P5 convergence** — explicitly
  parked-by-decision, _not a bug_ (`kosztorys-editor-domain-notes.md:359-371`).
- **First increment (Medium, plannable):** Podsumowanie **Robocizna/Materiały/Łącznie** summary split =
  OQ12a. The rest of the linkage (e.g. auto-`LABOR_COST` from rozpiska sum) is an open direction-of-dependency
  question, unspecced.

In v2 this is a **live join, not a sync** — no push, no mirror, no button.

### Lens 3 — Open-questions & slice reconciliation

**Genuinely uncaptured features (only two):**

- **`Podsumowanie` % udziału + Robocizna/Materiały/Łącznie split** (OQ12a, roadmap L52–59, 555–556). App's section-summary panel shows plain per-section totals but **not** the % udziału or the R/M/Łącznie split. **Plannable now** — pure parity, sheet is the spec. **No slice owns it — needs a number.**
- **Per-etap total („suma etapu")** (OQ12b, L555/557). New work, no parity to copy. **Owner-gated:** invoice figure (client price) vs payout figure (subcontractor, active view), and global vs per-section. Blocks its own slice until decided.
- _(borderline)_ OQ11 duplicate prace across presets — a decision **inside** the deferred `kosztorys-item-autocomplete` slice (EX-434), not wholly uncaptured.

**Stale / contradictory slice statuses to reality-check:**

- **S-01** — table says `done`, detail says `in review` (PR pending, prod migration + manual checks outstanding). Contradiction.
- **F-01 e2e-harness** — table says `ready`, baseline prose says "F-01 shipped". Contradiction.
- **S-03 kosztorys-stages** — `in review`, no archive note (adjacent stage-values already shipped). ← the flip we parked.
- **S-10 kosztorys-column-rbac** — `proposed`, but all prereqs (S-01/02/04) done → likely actionable, not truly "proposed".
- **O-01 sentry-observability** — `proposed`, standalone infra, plan-ready.
- _(nit)_ S-07 detail block L356 has a stray `proposed` leftover; authoritative Status + table both say `done`.

**Net:** outside the sheet-parity + dogfooding lenses (still running), the roadmap itself only hides **two** uncaptured features — OQ12(a) (plannable) and OQ12(b) (owner-gated). Everything else prose-flagged collapses into those.

---

## Consolidated gap table

_One row per deduped gap. Full detail + evidence in `missing-features.md`; this is the triage summary._

| #   | Gap (sheet vocabulary)                                                 | Sheet evidence                                               | App today                                           | Size | Disposition                                          |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | ---- | ---------------------------------------------------- |
| 1   | Oferta / eksport — client-facing offer view                            | both offer-view screenshots; `hiddenInExport` stored, unused | nothing consumes `hiddenInExport`; no filtered view | L    | `new-slice` (plannable)                              |
| 2   | PDF / eksport of the offer                                             | offer screenshots                                            | no kosztorys `buildPrintHtml` (transfers only)      | M    | `new-slice` (plannable)                              |
| 3   | Podsumowanie Robocizna / Materiały / Łącznie split                     | Podsumowanie r06–08                                          | plain per-section totals only                       | M    | `new-slice` (plannable)                              |
| 4   | Pie „% udziału" per sekcja                                             | Podsumowanie r11–23 (`section/Σ`)                            | data in a tooltip only                              | S–M  | `new-slice` (plannable)                              |
| 5   | Udział % base (Przedmiar vs executed)                                  | canonical `S=N×cena−rabat` vs test `S=O×cena−rabat`          | app on executed                                     | —    | `owner-decision`                                     |
| 6   | „do zapłaty" / suma transzy per etap                                   | kosztorys r396/r397 (`SUM(col5:394)`, ×1,08)                 | sums rows+sections, never the etap axis             | M    | `new-slice` (plannable) · price base → #7            |
| 7   | Per-etap price base (client vs subcontractor payout)                   | active-view switch                                           | executed-view only                                  | —    | `owner-decision`                                     |
| 8   | R netto/brutto — suma prac wykonanych                                  | r402/r403 named pair                                         | not surfaced                                        | S    | `new-slice` (plannable)                              |
| 9   | Footer „aktualnie do zapłaty R + M"                                    | r400 `=Σ(do-zapłaty)−Σ(zaliczki)+materiały`                  | robocizna-only totals bar                           | L    | `parked` (P5 financial plane)                        |
| 10  | Zaliczka — many advances per etap, hand-typed                          | r398/r400 stacked per-etap typed cells                       | none                                                | M    | `parked` (P5) · `owner-decision`                     |
| 11  | Materiały totals into R+M                                              | reads `wydatki inwestycyjne!I3/J3/K3`                        | investment txns exist, not summed here              | M    | `parked` (P5) — sum existing txns, no mirror         |
| 12  | Broader marża/transfers linkage (`LABOR_COST`/`PAYOUT`/`RABAT`/`LOSS`) | v1 mirror tabs                                               | v2 firewalled (FR-015)                              | L    | `parked` (P5) · `owner-decision`                     |
| 13  | `O komentarz` per-item column                                          | grid col `T` = komentarz                                     | app carries `Netto` there instead                   | S    | `new-slice`                                          |
| 14  | Kwota↔procent toggle + procent wykonania                               | dogfooding §8/§11                                            | absent                                              | M    | `covered` (EX-479, parked pre-code)                  |
| 15  | Brutto column placement                                                | far-right, owner scrolls                                     | no sheet parity                                     | S    | `owner-decision`                                     |
| 16  | Import existing sheets → app                                           | S-12                                                         | none                                                | L    | `covered` (S-12 deferred) · `owner-decision` (scope) |
| 17  | Grid hardening (resize fail, flicker, guideX, rename, tests)           | dogfooding §3/§6/§10                                         | live 🔴 EX-422                                      | —    | `covered` (EX-422 / S-15 / S-13 E2E)                 |
| —   | ~~Pokoje metraż tab~~                                                  | —                                                            | —                                                   | —    | **cut** (owner)                                      |
| —   | ~~Zakres z/bez narzędzi catalogues~~                                   | —                                                            | in-app view + coeffs added                          | —    | **covered**                                          |

**Side note — „pozostało do rozliczenia" (grid col `AE`, `=S − Σ(U:AD)`): the final formula is still under
owner discussion.** Don't harden any slice that depends on the pozostało/bilans definition until the owner
settles it — treat the current `S − Σ(wartość per etap)` as provisional, not spec.

**Disposition legend:** `covered` (existing slice/issue already does it) · `new-slice` (needs a slice
number) · `task` (ad-hoc Linear item) · `owner-decision` (blocked on a call) · `parked` (P5, out of arc).

**Read-off:** 6 plannable-now new slices (#1,2,3,4,6,8,13) · 4 owner-decisions (#5,7,15 + the pozostało
note) · 4 parked-P5 financial-plane (#9,10,11,12) · 3 already-covered (#14,16,17) · 2 cut.

---

## Real / varied sheets to scan

_Sheet ids for the parity audit's "real sheets" half — the SA needs read access to each._

- canonical (blank initial offer): `1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg` (tab `kosztorys_robocizny`)
- **filled test sheet (preferred fixture):** `1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4` — „wypełniony
  kosztorys do testów", real values + 9 tabs incl. the 3 v1-sync mirror tabs + `materiały`/`pokoje`/`Podsumowanie`.
  Layout: `T`=komentarz, `U–AE`=per-etap wartość, `AE`=bilans. Also in AGENTS.md reference block.
