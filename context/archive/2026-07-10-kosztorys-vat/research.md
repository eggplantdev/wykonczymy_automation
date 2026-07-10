---
date: 2026-07-10T00:00:00Z
researcher: ex-Plant
git_commit: 198ccf62f70572df5697e655384afabcb338f6e4
branch: main
repository: wykonczymy
topic: 'S-05 kosztorys-vat — VAT per investment (netto entry, brutto computed)'
tags: [research, codebase, kosztorys, investments, vat, editor]
status: complete
last_updated: 2026-07-10
last_updated_by: ex-Plant
---

# Research: S-05 kosztorys-vat — VAT per investment

**Date**: 2026-07-10
**Researcher**: ex-Plant
**Git Commit**: 198ccf6
**Branch**: main
**Repository**: wykonczymy

## Research Question

How should a single VAT rate per investment (`investments.vat_rate`) be added so that kosztorys
prices are entered **netto** and **brutto is computed** — one rate per investment, no
per-section/per-item rate, no cascade, no override (roadmap slice S-05)?

## Summary

**The feature is already scaffolded end-to-end and inert.** A `vatRate: number` is threaded
through the kosztorys tree and denormalized onto every editor row, with the intended formula
documented in code (`gross = net × (1 + vatRate)`), but the value is **hardcoded `0`** and never
read by any calc function. No brutto is ever computed or displayed. The work is small: **give
`vatRate` a real home on `investments`, surface it through the existing query slot, add one
read-only "Brutto" computed column, and expose the rate in the edit UI.**

The much larger downstream idea from the roadmap — a robocizna netto/brutto derivation for the
investor bill ("23% vs 8%") — **does not exist anywhere today** and is genuinely out of S-05
scope. Robocizna is a single flat figure with no net/gross split. S-05 is only the kosztorys
editor's price VAT.

Two `lessons.md` priors bite this slice directly:

- **react-datasheet-grid freezes `columns` at mount** — a new Brutto column (and any new view
  dimension) must be in the grid's remount `key`, or it silently no-ops.
- **Migration naming** — the `vat_rate` column migration must sort/order correctly and be
  hand-written (auto-`migrate:create` is stale).

## Detailed Findings

### 1. Investments collection — where `vat_rate` lands

- `src/collections/investments.ts:12` — slug `'investments'`. Closest existing pattern:
  `wToolsCoeff` (`:80`) and `ownToolsCoeff` (`:88`) — `number` fields with a `defaultValue`
  from `DEFAULT_COEFFS` (`src/lib/kosztorys/constants.ts:4`). Payload camelCase `vatRate` →
  DB column `vat_rate`.
- **These S-04 coeff fields are NOT exposed in the investment edit form** — they're edited only
  in Payload admin (`investment-form.tsx` omits them). That's the crux of the open UX question
  below: mirror that (admin-only) or surface `vatRate` in the form.

### 2. Migration pattern

- Hand-written, `YYYYMMDD_N_description.ts`, registered in `src/migrations/index.ts`.
- Closest analog (numeric column WITH default):
  `src/migrations/20260708_2_add_kosztorys_sections_items.ts:51-52`
  `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric NOT NULL DEFAULT 0.65;`
  (drops at `:60-61`). Import from `@payloadcms/db-vercel-postgres`.
- Prod migration is applied by a **human** via `pnpm db:migrate:prod`, **before** the code that
  needs it ships (AGENTS.md / `payload-prod-migrate` skill).

### 3. The query slot — one line, already stubbed

- `src/lib/queries/kosztorys.ts:119` — `return { …, vatRate: 0 }` (comment `:23` "scope: vatRate = 0").
  The `investment` doc is already fetched at `:58` (`payload.findByID`), and `globalCoeffs`
  (`:62-66`) is the exact "read a nullable numeric with a default fallback" pattern to copy for
  `vatRate: investment.vatRate ?? DEFAULT_VAT`.
- From there it already flows: `KosztorysTreeT.vatRate` (`types/kosztorys.ts:95`) →
  `v2-rows.ts:49,150,183` denormalizes onto each row → `KosztorysV2RowBaseT.vatRate`
  (`types/kosztorys.ts:103`, comment `gross = net × (1 + vatRate)`). Editor threads it at
  `use-kosztorys-editor.ts:191,250`. Tests already exercise `vatRate: 0.08`
  (`kosztorys-calc.test.ts:64`).

### 4. The Brutto column — reuse the existing computed-column mechanism

- `src/lib/tables/kosztorys-v2-columns.tsx:96-110` — `computedColumn(id, title, compute, className)`:
  read-only (`disabled: true`), custom `component`, value derived live from other cells.
- Two exist today (`:381-391`): **`net` "Netto"** → `rowNetForView(r, view)` (`calc.ts:47-49` =
  `measuredQty × viewPrice − discount`) and **`remaining` "Pozostało"**.
- A Brutto column is the same shape:
  `computedColumn('gross', 'Brutto', (r) => rowNetForView(r, view) * (1 + r.vatRate))`.
  **No item schema change** — VAT is per-investment, so nothing persists per row.
- **`kosztorys-editor-v2.tsx:76`** remount key is
  `` `${view}:${sort ? 'sorted':'natural'}:${widthsKey}:${stagesKey}` ``. Adding a static
  always-present Brutto column needs no key change; a _toggle_ to show/hide it (or a netto-vs-brutto
  _entry_ mode) would be a new orthogonal dimension that MUST enter this key.

### 5. Edit UI surface (if the rate is user-editable)

- Dialog `src/components/dialogs/edit-investment-dialog.tsx:33-43` (`defaultValues` + `updateInvestmentAction`).
- Form `src/components/forms/investment-form/investment-form.tsx:44-53,56-109` (`toData` + `field.Input`).
- Schema `src/components/forms/investment-form/investment-schema.ts:4-29`.
- Action `src/lib/actions/investments.ts` (`updateInvestmentAction`).
- To surface in the detail page read path: add to `InvestmentRefT`
  (`src/types/reference-data.ts:18-27`) + the SQL mapper `src/lib/queries/reference-data.ts:88-100`.

### 6. Robocizna / "23% vs 8%" — out of scope, confirmed

- Robocizna is `totalLaborCosts: sumRows(… type === 'LABOR_COST')`
  (`src/lib/db/investment-financials.ts:44`) — one flat sum, no net/gross split, flowing raw into
  bilans (`calculate-balance.ts:6-9`), marża (`calculate-margin.ts:13-14`), the "Robocizna" stat
  tile (`financial-stats.tsx:86-88`) and the print/export (`lib/export/header-fields.ts`,
  `print.tsx`). **No VAT split anywhere.**
- No `0.23`/`0.08`/construction-VAT constant exists in `src/` (only the inert `vatRate: 0` stub).
  The roadmap's "23% vs 8%" robocizna billing is entirely unbuilt — a future slice, not this one.

## Code References

- `src/collections/investments.ts:79-96` — coeff-field pattern to copy for `vatRate`
- `src/lib/kosztorys/constants.ts:4` — `DEFAULT_COEFFS`; add `DEFAULT_VAT` here
- `src/migrations/20260708_2_add_kosztorys_sections_items.ts:51-52,60-61` — numeric-column-with-default migration
- `src/migrations/index.ts` — register new migration
- `src/lib/queries/kosztorys.ts:23,58,62-66,119` — the `vatRate: 0` stub + fallback pattern
- `src/types/kosztorys.ts:95,103` — `vatRate` on tree + row (`gross = net × (1+vatRate)`)
- `src/lib/kosztorys/v2-rows.ts:49,150,183` — denormalization onto rows
- `src/lib/tables/kosztorys-v2-columns.tsx:96-110,381-391` — computed-column mechanism + Netto/Pozostało
- `src/lib/kosztorys/calc.ts:8,47-49` — net-only calc, VAT comment, `rowNetForView`
- `src/components/kosztorys/kosztorys-editor-v2.tsx:76` — grid remount `key`
- `src/components/forms/investment-form/*`, `src/components/dialogs/edit-investment-dialog.tsx` — edit UI

## Architecture Insights

- The whole `vatRate` path mirrors `globalCoeffs`: read once per tree from the investment doc,
  denormalize onto every row so calc/columns are pure row functions. This is the established
  "carry investment-level config through the tree" pattern — follow it, don't invent a new one.
- Brutto is a **presentation-only** derived value (like Netto/Pozostało). It never persists; the
  stored price stays netto (`clientPrice`). This keeps the S-02 subcontractor view toggle and VAT
  orthogonal — brutto = `netForView × (1 + vatRate)` composes over whichever view is active.
- Per-investment (not per-item) VAT is why no migration touches `kosztorys_items` — collection
  comments (`kosztorys-items.ts:9`, `kosztorys-sections.ts:6`) already pin this.

## Historical Context (from prior changes)

- `context/changes/kosztorys-sections-items/plan.md` — S-01/S-04 built the v2 editor, the
  section/item tables, and the subcontractor coeff fields whose pattern `vatRate` copies.
- `context/foundation/lessons.md:98` — dsg column-freeze lesson (remount key).
- `context/foundation/lessons.md:112` — migration filename-order lesson.

## Open Questions

1. **Where is the rate edited? (roadmap decision 4/8, owner-owned)** — Payload admin only (mirror
   the S-04 coeffs, cheapest) vs. surface `vatRate` in the investment edit form / a future
   "Podsumowanie" panel. The side panel is explicitly ruled out. **Owner decision.**
2. **Default rate value** — `DEFAULT_VAT`. Finishing/construction services in PL are often 8%,
   general 23%. What default (and is per-investment override the only input, i.e. no code default
   assumption downstream)? **Owner decision.**
3. **Is Brutto always shown, or toggled?** Always-on column = no remount-key change; a toggle =
   new dimension in the grid `key`. Recommend always-on read-only column for MVP.
4. **Does `vatRate` need to reach the detail-page read path** (`InvestmentRefT` /
   `reference-data.ts`), or only the kosztorys query? Only needed if the edit form or a summary
   tile displays it. Depends on Q1.
5. **Section-summary brutto** — `kosztorys-section-summary.tsx:259` shows "Suma netto". Does the
   summary need a brutto counterpart too, or only the grid column? Likely yes for parity — confirm scope.
