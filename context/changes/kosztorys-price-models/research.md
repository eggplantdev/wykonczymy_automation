---
date: 2026-07-09T00:00:00+02:00
researcher: Claude (Opus 4.8)
git_commit: f86337ef0c3b135e7a67115e88c053b24b597ed8
branch: kosztorys-sections-items
repository: wykonczymy
topic: 'S-03 — three price models + pricing-view toggle: current state and residual scope'
tags: [research, codebase, kosztorys, pricing, s-03, s-11]
status: complete
last_updated: 2026-07-09
last_updated_by: Claude (Opus 4.8)
---

# Research: S-03 — three price models + pricing-view toggle

## Research Question

Scope slice S-03 ("record three price models per item and toggle the pricing view") for
`/10x-plan`: what already exists, what remains, and how it splits from S-11.

## Summary — the headline

**S-03 is already built.** The S-01 north-star slice (`kosztorys-sections-items`, status
`implemented`) explicitly **folded S-03 and S-11 into itself** and shipped both. Verified against
live code, not docs:

- The **three price views** (`client` / `w_tools` / `own_tools`) and their pure calc exist and
  work: `viewPrice`, `subcontractorPrice`, `effectiveCoeff`, `rowNetForView`,
  `sectionSubtotalsForView` (`src/lib/kosztorys/calc.ts:24-98`).
- The **coefficient + two-state-override derivation** (the S-11 substance) is fully persisted and
  mutable: investment global → section (nullable) → per-item `coeff`/`amount`/null override.
- The **pricing-view toggle** is rendered, wired, and correct: toolbar buttons
  (`kosztorys-editor-toolbar.tsx:8-52`), `view` state (`use-kosztorys-editor.ts:67`), `view`
  in the dsg remount `key` (`kosztorys-editor-v2.tsx:73`), and both the price column and the
  section/grand totals recompute under the active view (`use-kosztorys-editor.ts:100,126-127`).

The source of the intent: `context/changes/kosztorys-sections-items/change.md:29-31` ("**Fold
S-03 in**") and `:32-37` ("**Coefficient model now → S-01 absorbs S-11**"), with `:48` — "Update
`roadmap.md` at archive time: S-11 is folded here (mark it done/absorbed); S-03 folded." **That
archive step was never run** — `roadmap.md` still lists S-03 (line 170) and S-11 (line 275) as
`proposed`. This research exists because the roadmap's stale status made S-03 look like open build
work.

**Conclusion: there is essentially no build work in S-03 as originally scoped.** What remains is
(a) roadmap bookkeeping and (b) runtime verification that S-01 deferred to S-08 — plus a few small,
genuinely-unbuilt polish items that were never part of S-03's charter and would be _new_ scope.

## Detailed Findings

### What S-01 shipped for pricing (verified in code)

**Types** (`src/types/kosztorys.ts`):

- Item price fields: `clientPrice` (32), `wToolsOverrideType|null` (33) + `wToolsOverrideValue`
  (34), `ownToolsOverrideType|null` (35) + `ownToolsOverrideValue` (36), `costVariant|null` (37),
  `discountType|null` (28) + `discountValue` (29).
- Aliases: `DiscountTypeT = 'percent'|'amount'`, `CostVariantT = 'w_tools'|'own_tools'`,
  `SubcontractorOverrideTypeT = 'coeff'|'amount'`.
- Coefficients denormalized onto rows; `KosztorysGlobalCoeffsT = { wTools; ownTools }`;
  `DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.55 }` (`constants.ts:4`).
- `vatRate` threaded on every row but **carried as 0** (netto-only; VAT = S-12).

**Calc** (`src/lib/kosztorys/calc.ts`):

- `PriceViewT = 'client' | 'w_tools' | 'own_tools'` (24).
- `effectiveCoeff` (27-30): section coeff `??` global coeff (section overrides global; no
  item-level coeff — item overrides via type/value).
- `subcontractorPrice` (33-39): `amount` → flat value; `coeff` → `clientPrice × value`; `null` →
  `clientPrice × effectiveCoeff`.
- `viewPrice` (41-44): `client` → `clientPrice`; else → `subcontractorPrice`.
- `rowNetForView` (47-49): `applyDiscount(measuredQty × viewPrice, row)` — net on **pomiar**.
- `sectionSubtotalsForView` (74-98): per-section net over the full dataset + `share`.
- **No `rowGross`, no VAT/brutto** in calc — netto-only, as intended.

**Persistence** (`src/migrations/20260708_2_add_kosztorys_sections_items.ts`):

- `kosztorys_items`: `client_price`, `w_tools_override_type/value`, `own_tools_override_type/value`,
  `cost_variant`, `discount_type/value`, `hidden_in_export`.
- `kosztorys_sections`: `default_cost_variant` (default `'w_tools'`), `w_tools_coeff`/`own_tools_coeff`
  (nullable = inherit).
- `investments`: `w_tools_coeff DEFAULT 0.65`, `own_tools_coeff DEFAULT 0.55`.
- **Deliberately omitted** (header comment 3-7): `vat_rate` (S-12) and any stored
  `subcontractor_*_price` (derived, not stored).

**Actions** (`src/lib/actions/kosztorys.ts`): `updateItemFieldAction` accepts every price/override
field; `updateSectionFieldAction` accepts section coeffs; `updateInvestmentCoeffsAction` sets global
coeffs (revalidates items + sections since a global coeff changes derived prices). All Zod-validated.

**Editor UI**:

- Toolbar buttons, labels: `client`→"Robocizna", `w_tools`→"Z narzędziami", `own_tools`→"Bez narzędzi"
  (`kosztorys-editor-toolbar.tsx:8-12`).
- "Cena" column bound per view: client → plain editable `clientPrice`; sub views → `priceMode`
  (tryb) + `price` override columns, derived value shown grey/italic when override type is null
  (`kosztorys-v2-columns.tsx:144-217,308-325`).
- Computed "Netto" column via `rowNetForView` (365). No brutto column.
- Remount `key={`${view}:${sort?'sorted':'natural'}:${widthsKey}`}` (`kosztorys-editor-v2.tsx:73`).

### The S-03 / S-11 boundary (as roadmap intended vs. reality)

- Roadmap intent: **S-03** = the "one dataset, three views" toggle (FR-003, `roadmap.md:162-165`);
  **S-11** = the coefficient+override derivation (`roadmap.md:265-274`, depends on S-01 + S-03).
- Reality: **S-01 absorbed both.** POC settled the coefficient model in
  `context/archive/kosztorys-poc-in-app/2026-06-20-kosztorys-subcontractor-pricing-design.md`
  (supersedes the old "3 snapshot columns" design), and S-01 ported the POC's _final_ `calc.ts` +
  `v2-rows.ts` verbatim — which already implement it.

### FR-003 (verbatim)

`context/foundation/prd.md:167-170`: "Manager+ can record three price models per item and toggle the
pricing view (klient / podwykonawca z narzędziami / własne narzędzia). … Stands — inspection
confirmed all three carry real data."

## Residual candidates (none are original S-03 scope)

1. **Roadmap bookkeeping** — mark S-03 + S-11 `done`/absorbed (the never-run archive step,
   change.md:48). Pure doc edit.
2. **Runtime verification** — S-01 unit-tested only the pure calc; the toggle + three views + totals
   were never verified in-browser (S-01 manual check 4.6 unchecked; browser E2E deferred to S-08).
   This is S-08 territory, not a build slice.
3. **View persistence** — `view` resets to `'client'` on every mount; no localStorage/per-user/
   per-kosztorys persistence. Column widths use a per-browser localStorage pattern
   (`use-column-widths.ts:11`) that could be mirrored. **Never scoped to S-03** — would be new.
4. **Label/UX polish** — a "Bez narzędzia" typo in one label; toolbar labels differ from the
   section-panel coefficient labels; the columns file flags a wanted "explanation above the table"
   for the non-obvious pricing model (`kosztorys-v2-columns.tsx:24-25`). Cosmetic.
5. **Hide subcontractor cost/margin from MANAGER** — today all of ADMIN/OWNER/MANAGER see & edit
   everything. This is POC follow-on **P10**, parked with **S-14** (column-locking), **not** S-03.
6. **netto/brutto** — downstream of **S-12** (per-investment VAT); `rowGross` ported but unwired.

## Architecture Insights

- **The "computed, not stored" rule holds throughout** — only inputs (clientPrice, override
  type/value, coeffs, discount) persist; all view prices/nets/subtotals are pure functions. This is
  why folding S-11's model into S-01 was cheap: one port of `calc.ts`.
- **dsg freezes `columns` at mount** — every column-shaping dimension (`view`, sort on/off, widths)
  must be in the grid `key`. Already handled; see `lessons.md` entry.

## Historical Context (from prior changes)

- `context/changes/kosztorys-sections-items/change.md:29-48` — the fold decisions + the un-run
  archive instruction.
- `context/changes/kosztorys-mvp/change.md:56-60` — POC decision register: coefficient model +
  "one dataset, three views".
- `context/archive/kosztorys-poc-in-app/2026-06-20-kosztorys-subcontractor-pricing-design.md` —
  the settled coefficient+override design (supersedes the snapshot-columns variant).

## Open Questions (for the user, before any plan)

1. Since S-03 is already shipped, do we **close it out** (roadmap bookkeeping + optional browser
   verification) and move to a slice with real build work (S-04 stages / S-06 catalogue / S-07
   export / S-12 VAT)?
2. Or **redefine `kosztorys-price-models`** to the residual polish (view persistence + label/UX
   cleanup + pricing-model explainer) — a small slice?
3. Or fold the verification into **S-08** where it belongs and skip a standalone S-03 entirely?
