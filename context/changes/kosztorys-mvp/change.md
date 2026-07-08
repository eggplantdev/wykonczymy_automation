---
id: kosztorys-mvp
title: In-app kosztorys editor — MVP (proper build on POC learnings)
status: planned
created: 2026-07-08
updated: 2026-07-08
---

# In-app kosztorys editor — MVP

Proper, test-gated build of the in-app kosztorys (robocizna) editor, replacing the Google
Sheets authoring flow for new investments. The **POC** (`poc-kosztorys-in-app` branch) proved
the approach and settled the shape; this change rebuilds it clean — with tests, quality gates,
review — porting the POC's tested calc core and its decision register rather than its throwaway
editor/migration code.

> **This file is the durable capture of the planning done in conversation (2026-07-08).** It is
> NOT yet a `/10x-plan` output and NOT yet started. Branch creation + Linear mirroring are on
> hold ("wait with branching off"). Sources: the POC decision register
> `context/changes/kosztorys-poc-in-app/change.md` (on `poc-kosztorys-in-app`) and the current
> `context/foundation/roadmap.md`.

## POC verification — conclusions (2026-07-08, 3-agent sweep)

- **Data model holds:** `kosztorys_sections` / `kosztorys_items` / `kosztorys_stages` /
  `stage_progress`. No separate materials table (materials = `INVESTMENT_EXPENSE`, already in
  app). **`kosztorys_rooms` is an orphan** — pokoje were cut from scope (owner, 2026-06-20).
- **All editor slices built + wired end-to-end**; editor = **`react-datasheet-grid`** (v2, won
  the bake-off; v1/TanStack deleted after porting its advantages).
- **Calc core is pure + tested** (`src/lib/kosztorys/calc.ts`, `v2-rows.ts`) — values are
  **computed, not stored**; only inputs persist. Perf ~1000 rows PASS.
- **Verdict:** approach proven. Rebuild clean; **port the tested calc core + this decision
  register**; **drop** the POC editor/migrations, `kosztorys_rooms`, seed scripts, and the
  inv-7 shortcut.

## POC decisions carried into MVP ([PEWNE] unless noted)

- **Clean start, app DB = source of truth, ZERO sheet import.** Sheets proven unreliable (drift).
- **Values computed, not stored** (pure functions): netto, brutto, "pozostało", section/grand
  sums, marża. Zero formula drift.
- **Przedmiar + pomiar = two independent editable columns**; value computed from **pomiar**
  (template seeds pomiar from przedmiar).
- **Dynamic stages** (`kosztorys_stages` rows, columns rendered from data); `stage_progress`
  sparse (missing = 0). Deleting a stage with recorded progress = blocked (clear first).
- **Two-mode discount:** `discount_type ∈ {percent, amount}` + `discount_value`.
- **VAT per investment** (`investments.vat_rate`): prices entered **netto**, brutto computed.
  One rate per investment — NOT per section/item. No cascade, no overrides.
- **Robocizna = Σ stages = value of work DONE** (item is the unit; stage is a progress overlay,
  worker enters only `qtyDone`). No header sum figure (removed).
- **Robocizna netto vs brutto = derived from client billing context** (B2B? 23% vs 8%) — a
  determined rule, not an open question; ties to VAT-per-investment.
- **Subcontractor pricing = markup coefficient + two-state override** (replaces the old "3
  snapshot columns"). `clientPrice` is the snapshot; with/without-tools derived via a coefficient
  inherited global(investment)→section(nullable), per-item override (`coeff`/`amount`/null).
- **"One dataset, three views"** — active-price toggle (Robocizna / z narzędziami / bez
  narzędzi) swaps the price column + its computed values; pomiar/stages unchanged. (POC bug:
  dsg freezes `columns` on mount → `view` must be in the grid remount key. Lesson in
  `lessons.md`.)
- **Autosave per field, optimistic, debounced; no Save button; revert-on-error.**
- **Access:** `MANAGEMENT_ROLES` (ADMIN/OWNER/MANAGER) full; EMPLOYEE no access.
- **Coexistence** with the "Arkusz" tab; sheet integration untouched until cutover.
- **[SKRÓT POC → revisit at MVP]:** UI persistence is per-browser/global localStorage (consider
  per-user and/or per-kosztorys); no hiding of sensitive subcontractor cost/margin columns from
  MANAGER (follow-on: OWNER/ADMIN-only — POC question #P10).

## Owner slice-shaping decisions (2026-07-08)

1. **S-10 importer → deferred**, post-MVP band (not in the MVP arc).
2. **Undo + column-locking → in the MVP** (own slices).
3. **VAT + subcontractor pricing → their own slices** (not folded into S-01/S-03).
4. **Settings-home UX (where VAT + subcontractor coefficients are edited) → TBD** — open note on
   the VAT/subcontractor slices; owner said detail-inwestycji OR a future "Podsumowanie" panel,
   not the side panel.

## Reconciliation delta vs current `roadmap.md`

The roadmap (created 2026-06-12) predates the POC (2026-06-19), so S-01…S-10 never absorbed the
POC decisions. Proposed changes (to be written into `roadmap.md` when the branch hold lifts):

- **F-01 e2e-harness, S-01 sections-items (north star), S-02 financial-core-smoke, S-03 price
  models, S-04 stages, S-06 catalogue, S-07 export, S-08 editor-e2e, S-09 new-investment-no-sheet**
  — keep.
- **S-05 rooms — CUT** (pokoje out of scope; `kosztorys_rooms` is dead).
- **S-10 importer — keep but deferred** to a post-MVP band.
- **Add S-11 subcontractor-pricing**, **S-12 VAT-per-investment**, **S-13 undo**,
  **S-14 column-locking**, **S-15 hardening** — own slices.
- **Fold into existing slices:** two-mode discount → S-01; robocizna netto/brutto → S-01/S-03.
- Settings-home placement rides as an open note on S-11/S-12 (decision 4).

## To port from the POC (not rebuild)

- `src/lib/kosztorys/calc.ts` + `v2-rows.ts` (tested pure calc core).
- This decision register + the POC's slice-level specs (rationale).
- **Drop:** POC editor component, POC migrations, `kosztorys_rooms`, seed scripts, inv-7 shortcut.

## Open items / pending decisions

- **Branch base** — feature branch off `main` (agreed), but `main`'s `roadmap.md` is older than
  this branch's; the reconciled roadmap will be re-authored on the build branch. On hold.
- **Settings-home UX** (decision 4) — unresolved.
- **PR13 review doc** (`context/reference/plans/2026-05-27-kosztorys-pr13-simplify-review.md`) —
  predates the three-tab split, unverified; not load-bearing for MVP.
- **Linear** — mirror slices once access is reality-checked and the hold lifts.
