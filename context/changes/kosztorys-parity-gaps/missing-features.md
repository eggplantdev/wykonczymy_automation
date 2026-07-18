# Missing features — kosztorys v2 (capture checklist)

Deduped from the four discovery lenses + owner braindump (see `braindump.md` for evidence/quotes).
**Not a status tracker** — Linear ("Wykonczymy") owns live status. This is the triage backlog: each
item becomes a slice / Linear issue when it goes active, and the box checks when it's _captured there_
(id recorded), not when it's built.

**Disposition tags:** `plannable` (spec is clear, can `/10x-plan` now) · `owner-decision` (blocked on a
call) · `parked-P5` (deliberately deferred — the marża/financial-plane firewall) · `existing` (already
has a Linear id) · `hardening` (falls to S-15/E2E) · `slice?` (needs a slice number).

---

## A. Financial-plane linkage (v1 wiring → live join, NOT the sync button)

- [ ] **Footer „aktualnie do zapłaty R + M" total** (netto+brutto) — evidence (filled sheet r400):
      `=Σ(do-zapłaty netto per etap) − Σ(zaliczki) + materiały actuals`. So it's **robocizna per etap
      − zaliczki + materiały**, netto then ×1,08 brutto. `parked-P5` · `slice?` — the headline capability.
- [ ] **Materiały totals into the R+M figure** — the sheet's `materiały` / `wydatki inwestycyjne` /
      `transfery` / `rozliczone R+M` tabs are just **transaction lists the app already holds**. We do NOT
      replicate the tabs — we only need their **totals** summed into „do zapłaty" (sheet reads
      `'wydatki inwestycyjne'!I3/J3/K3`). Capability = sum existing investment transactions, no mirror. `parked-P5`
- [ ] **„do zapłaty" / suma transzy per etap** (r396/r397) — each etap column = `SUM(<col>5:394)` = Σ that
      etap's executed wartość across all items; brutto = netto × 1,08. App sums rows + sections but **never
      the etap axis**. `plannable` (this is the concrete form of the old "suma transzy" gap)
- [ ] **Podsumowanie Robocizna / Materiały / Łącznie split** (OQ12a) — spec confirmed (Podsumowanie r06–08):
      Robocizna = wartość-netto total, Materiały = materiały total, Łącznie = sum; each with udział%. `plannable` · `slice?`
- [ ] **Zaliczka — many advances per etap, hand-typed.** Advances the client paid, on the etap axis.
      Evidence: **several** „zaliczka netto" rows (r398 _and_ r400 …) each carry per-etap typed numbers, so one
      etap column stacks multiple advances (col W = 20 000 in r398 **+** 20 000 in r400). Data model = a
      **list of zaliczki, each tagged to an etap** (not one figure per etap). Per-etap zaliczka = Σ of that
      etap's advances; **netted into „do zapłaty" per etap**, then summed. Cells are plain numbers, no formula
      — owner enters each. ⚠️ the sheet's `SUM(U398:AD403)` spans netto+brutto+label rows (likely a broken
      double-count) — spec the intent (`Σ zaliczka netto per etap`), not the exact range. `parked-P5` · `owner-decision`
- [ ] **Broader marża/transfers linkage** (`LABOR_COST`/`PAYOUT`/`RABAT`/`LOSS`) — e.g. auto-`LABOR_COST` from rozpiska sum. `parked-P5` · `owner-decision` (direction-of-dependency unspecced)

## B. Oferta / eksport (largest non-parked gap)

- [ ] **Offer view** — consume `hiddenInExport`, render a filtered client-facing view. `plannable` · `slice?`
- [ ] **PDF / eksport** of the offer (no kosztorys `buildPrintHtml` today). `plannable` · `slice?`

## C. Podsumowanie / summary viz

- [ ] **Pie „% udziału" per sekcja** — spec confirmed (Podsumowanie r11–23): per-section value + `section/Σ` %.
      App has the data in a tooltip only; no chart / always-visible block. `plannable` · `slice?`
- [ ] **Udział % base semantics** — **confirmed as a real fork**: canonical weights on Przedmiar (`S=N×cena−rabat`),
      this test sheet on executed (`S=O×cena−rabat`). Owner picks the base. `owner-decision`

## D. Stage (etap) axis

- [ ] **Suma transzy** — per-etap column totals → **now specced in §A** („do zapłaty" per etap = `SUM(col5:394)`).
      Remaining `owner-decision`: client price vs subcontractor payout figure.
- [ ] **Per-etap total „suma etapu"** (OQ12b) — new work, no parity. `owner-decision` · `slice?`
- [ ] **R netto / R brutto — suma prac wykonanych** named pair surfaced. `plannable` (trivial readout)

## E. Columns / editor features

- [ ] **`O komentarz` per-item column** — present in the filled test sheet, absent in app. `slice?`
- [ ] **Brutto column placement** — far-right, owner must scroll; no sheet parity. `owner-decision`
- [ ] **Kwota↔procent toggle + procent wykonania** (per item & per stage). `existing` EX-479 (parked pre-code)

## F. Other tabs / catalogues

- [x] ~~**Pokoje** metraż calculator tab~~ — **cut** (owner: "pokoje gone"). Not a gap.
- [x] ~~**Zakres z / bez narzędzi** catalogues~~ — **covered**: already a view in-app, different coeffs already added.

## G. Importer

- [ ] **Import existing sheets → app** (S-12). Varied/messy layouts → per-sheet descriptor + calc-diff
      audit (see the discussion; core once + agentic per-sheet). `existing` S-12 (deferred) · `owner-decision` (scope: dev-tool vs full slice)

## H. Grid / hardening (no slice owns these)

- [ ] **Intermittent column-resize failure** — live 🔴. `existing` EX-422
- [ ] delete-repaint flicker · `guideX` containing-block bug · stage-header rename regression · missing EX-422 tests. `hardening` (S-15 / S-13 E2E)

## I. Roadmap hygiene (not features — reconcile before planning)

- [ ] Reality-check stale/contradictory statuses: **S-01** (done vs in-review), **F-01** (ready vs shipped),
      **S-03** (in-review, likely done — parked flip), **S-10** (proposed but prereqs done), **O-01** (proposed).
- [ ] Fix S-07 detail-block stray `proposed` leftover (authoritative status = done).
