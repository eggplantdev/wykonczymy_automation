# VAT per investment (netto entry, brutto computed) — Implementation Plan

## Overview

Give the inert `vatRate` scaffold a real home. Each investment gets one VAT rate
(`investments.vat_rate`, stored as a fraction, default `0.08`). Kosztorys prices stay **netto**;
**brutto is computed** per row (`net × (1 + vatRate)`) as a toggleable read-only grid column and a
`Suma brutto` grand-total line. The rate is entered and edited **inside the kosztorys editor**
(the Sekcje panel), persisting to the investment via a server action — no per-section/per-item
rate, no cascade, no override.

## Current State Analysis

`vatRate` is already threaded end-to-end but hardcoded to `0` and never read by any calc:

- `src/lib/queries/kosztorys.ts:119` returns `vatRate: 0` (comment `:23` "scope: vatRate = 0"). The
  `investment` doc is already fetched at `:58`; `globalCoeffs` (`:62-66`) is the fallback-read pattern.
- `KosztorysTreeT.vatRate` (`src/types/kosztorys.ts:95`) → denormalized onto each row
  `KosztorysV2RowBaseT.vatRate` (`:103`, comment `gross = net × (1 + vatRate)`), via
  `src/lib/kosztorys/v2-rows.ts:49,150,183` and `use-kosztorys-editor.ts:191,250`.
- No calc function reads `vatRate` (`src/lib/kosztorys/calc.ts:8`). Netto is the only money value:
  `rowNetForView` (`calc.ts:47-49`) = `measuredQty × viewPrice − discount`. **No brutto anywhere.**
- The editor persists investment-level settings from the Sekcje panel already:
  `handleGlobalCoeffChange` → `updateInvestmentCoeffsAction` with optimistic `patchRows` + `router.refresh()`
  (`use-kosztorys-editor.ts:356-367`). This is the exact template for persisting `vatRate`.
- The grid remount key is `` `${view}:${sort?'sorted':'natural'}:${widthsKey}:${stagesKey}` ``
  (`kosztorys-editor-v2.tsx:78`). dsg freezes `columns` at mount — a toggleable Brutto column MUST
  add its state to this key.
- `investments` collection (`src/collections/investments.ts:79-96`) has `wToolsCoeff`/`ownToolsCoeff`
  `number` fields with `defaultValue` — the pattern `vatRate` copies. Defaults in
  `src/lib/kosztorys/constants.ts:4`.

## Desired End State

Opening a kosztorys shows a per-row **Brutto** column and a **Suma brutto** total when the brutto
toggle is on; both recompute live from the entered netto prices and the investment's VAT rate. A
VAT-rate field in the Sekcje panel (shown as a percent, e.g. `8`) edits the rate, persists to
`investments.vat_rate`, and every brutto figure updates. Default rate for any investment without one
is 8%. Verify: set rate to 8, a netto `100.00` line shows brutto `108.00`; toggle off hides both
brutto surfaces; reload preserves the rate.

### Key Discoveries:

- `vatRate` plumbing is complete and inert — wire into it, don't re-add it (`kosztorys.ts:119`).
- Brutto = reuse the read-only `computedColumn` mechanism (`kosztorys-v2-columns.tsx:96-110`), like
  the existing Netto/Pozostało columns (`:381-391`). No item-schema change — VAT is per-investment.
- Persisting the rate from the editor mirrors `handleGlobalCoeffChange` exactly (`use-kosztorys-editor.ts:356-367`).
- dsg column-freeze lesson (`context/foundation/lessons.md:98`): the brutto toggle belongs in the
  grid `key`.
- Migration lesson (`lessons.md:112`) + `payload-prod-migrate`: hand-write the migration, human
  applies to prod **before** the code ships.

## What We're NOT Doing

- No per-section or per-item VAT rate, no cascade, no override (one rate per investment).
- No robocizna netto/brutto derivation for the investor bill ("23% vs 8%") — confirmed unbuilt today
  (`investment-financials.ts:44` is a flat sum); that is a future slice, out of scope.
- No special export/print view — export mirrors current visible editor state (settled in POC); a
  dedicated export view may come later.
- No per-section brutto lines in the summary — net per section stays; only the grand `Suma brutto`
  is added (the client-decision figure).
- `vatRate` does not surface in `InvestmentRefT` / the investment edit form — only the kosztorys
  query + the editor write path need it.

## Implementation Approach

Two phases split on the schema/code boundary (so prod migration is applied deliberately before the
code that reads the column ships). Phase 1 is backend-only: column + collection field + default +
query wiring. Phase 2 is the editor UI: brutto column (toggleable), grand-total `Suma brutto`, and
the in-editor VAT-rate input with its persist action.

## Critical Implementation Details

- **Rate units:** persist a **fraction** (`0.08`) to honor the `gross = net × (1 + vatRate)`
  contract already in the types; the input field shows/accepts a **percent** (`8`), converting
  `×100` on display and `/100` on commit. Keep the conversion in one place (the field's commit
  handler) so the stored value is unambiguously a fraction everywhere else.
- **Migration ordering & prod:** hand-write (auto `migrate:create` is stale), name so filename sort
  matches dependency order, register in `src/migrations/index.ts`, and a **human** applies it to
  prod via `pnpm db:migrate:prod` **before** Phase 2 code is pushed.
- **Grid remount:** the brutto toggle state must enter the `key` in `kosztorys-editor-v2.tsx:78`, or
  toggling silently no-ops (dsg freezes columns at mount).
- **Optimistic rate change:** on commit, `patchRows(() => true, r => ({...r, vatRate}))` then
  `updateInvestmentVatAction` + `router.refresh()` — a bare refresh won't reseed `rows` (the
  `useState` initializer runs once), mirroring the coeff handler.

## Phase 1: Schema + query wiring (backend)

### Overview

Add the `vat_rate` column, expose it as a Payload field with an 8% default, and read it into the
kosztorys tree.

### Changes Required:

#### 1. Migration — add `vat_rate` to `investments`

**File**: `src/migrations/<YYYYMMDD>_<n>_add_vat_rate_to_investments.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add a non-null numeric VAT-rate column defaulting to 8% so existing investments get a
sensible rate without a backfill.

**Contract**: `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "vat_rate" numeric NOT NULL DEFAULT 0.08;`
with matching `DROP COLUMN IF EXISTS` in `down`. Copy structure/imports from
`20260708_2_add_kosztorys_sections_items.ts:51-52,60-61`.

#### 2. Default constant

**File**: `src/lib/kosztorys/constants.ts`

**Intent**: One source of truth for the default rate, used by the collection default and the query
fallback.

**Contract**: Add `DEFAULT_VAT = 0.08` (fraction) alongside `DEFAULT_COEFFS`.

#### 3. Investments collection field

**File**: `src/collections/investments.ts`

**Intent**: Expose `vatRate` as an editable number field (fraction) so the value is a real Payload
field, not just a raw column.

**Contract**: `number` field `vatRate`, `defaultValue: DEFAULT_VAT`, mapped to `vat_rate`. Copy the
`wToolsCoeff` field shape (`:79-87`).

#### 4. Query wiring

**File**: `src/lib/queries/kosztorys.ts`

**Intent**: Read the investment's rate into the tree instead of the hardcoded `0`.

**Contract**: Replace `vatRate: 0` (`:119`) with `vatRate: investment.vatRate ?? DEFAULT_VAT`; drop
the "scope: vatRate = 0" comment (`:23`). The `investment` doc is already in scope (`:58`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Migration applies cleanly on the local DB: `pnpm payload migrate` (local docker only)
- Existing kosztorys calc tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`

#### Manual Verification:

- A local investment's kosztorys tree now carries the real `vatRate` (not 0) — confirm via the row
  data or a temporary log.
- Payload admin shows the VAT field on an investment with default 0.08.

**Implementation Note**: After Phase 1 automated checks pass, a human applies the migration to prod
(`pnpm db:migrate:prod`) **before** Phase 2 code is pushed. Pause for manual confirmation before proceeding.

---

## Phase 2: Editor UI — brutto column, Suma brutto, in-editor rate input

### Overview

Render brutto (toggleable) in the grid and as a grand total, and let the user edit the VAT rate
from the Sekcje panel with optimistic persistence.

### Changes Required:

#### 1. Brutto computed column

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Add a read-only per-row Brutto column next to Netto, shown only when brutto is visible.

**Contract**: `buildV2Columns` gains a `bruttoVisible: boolean` arg; when true, append
`computedColumn('gross', 'Brutto', (r) => rowNetForView(r, view) * (1 + r.vatRate))` beside the
`net` column (`:381-391`). Reuse `fmt`. VAT applies to post-discount net (net already subtracts discount).

#### 2. Brutto toggle state + remount key

**Files**: `src/components/kosztorys/use-kosztorys-editor.ts`, `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Intent**: Hold a `bruttoVisible` toggle, feed it to `buildV2Columns`, and fold it into the grid
remount key so the column appears/disappears.

**Contract**: New `bruttoVisible` state in the hook (mirror `usePriceView(investmentId)` persistence
if per-investment persistence is wanted; otherwise local `useState`), passed to `buildV2Columns` and
returned. In `kosztorys-editor-v2.tsx:78` extend the key to
`` `${view}:...:${stagesKey}:${bruttoVisible}` ``.

#### 3. Toolbar toggle

**File**: `src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: A "Brutto" toggle button next to the view buttons.

**Contract**: New `bruttoVisible` + `onToggleBrutto` props; a `Button` with
`variant={bruttoVisible ? 'default' : 'outline'}` (pattern of the Sekcje button `:83`).

#### 4. VAT-rate input in the Sekcje panel + persist handler

**Files**: `src/components/kosztorys/kosztorys-section-summary.tsx`,
`src/components/kosztorys/use-kosztorys-editor.ts`, `src/lib/actions/kosztorys.ts`

**Intent**: Edit the per-investment VAT rate from the panel (percent display), persisting optimistically.

**Contract**: In the panel's settings block (near the global-coeff `CoeffField`s, `:130-144`) add a
VAT field showing `vatRate * 100` and committing `n / 100`. New `updateInvestmentVatAction(investmentId, vatRate)`
in `src/lib/actions/kosztorys.ts` (mirror `updateInvestmentCoeffsAction`), and a `handleVatChange`
in the hook mirroring `handleGlobalCoeffChange` (`:356-367`): `patchRows(() => true, r => ({...r, vatRate}))`
→ action → `router.refresh()`. Thread `vatRate` (fraction) into the summary props.

#### 5. Suma brutto grand total

**File**: `src/components/kosztorys/kosztorys-section-summary.tsx`

**Intent**: Add a `Suma brutto` line under `Suma netto`, shown only when brutto is visible.

**Contract**: New `vatRate` + `bruttoVisible` props; when `bruttoVisible`, render a line
`fmt(grandNet * (1 + vatRate))` mirroring the `Suma netto` markup (`:258-261`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`
- Calc tests pass (add a brutto assertion): `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`

#### Manual Verification:

- With rate 8%, a netto `100.00` line shows Brutto `108.00`; `Suma brutto` = `Suma netto × 1.08`.
- Toggling Brutto off hides both the column and `Suma brutto`; on restores them (no stale render —
  confirms the remount key).
- Editing the VAT field (enter `23`) updates every brutto figure live and persists across reload.
- Brutto is consistent across all three price views (Klient / Z narzędziami / Bez narzędzi).
- No regressions to netto totals, coeff editing, stages, or autosave.

**Implementation Note**: Verify against the running dev server in the browser (not just tsc) — the
dsg remount + React Compiler bite only at runtime. Pause for manual confirmation before archiving.

---

## Testing Strategy

### Unit Tests:

- Extend `src/__tests__/kosztorys-calc.test.ts` (already passes `vatRate: 0.08`) with a brutto
  assertion: `rowNetForView(r, view) * (1 + vatRate)` for a known net + rate, including a discounted
  row (VAT on post-discount net) and across views.

### Manual Testing Steps:

1. Set an investment's VAT to 8% in the editor; add a netto `100.00` line → Brutto `108.00`.
2. Toggle Brutto off/on → column and `Suma brutto` hide/show cleanly.
3. Change VAT to 23% → all brutto figures update; reload → rate persists.
4. Switch price views → brutto stays consistent with the active net.

## Migration Notes

Single additive column, `NOT NULL DEFAULT 0.08` — existing rows backfill to 8% automatically, no
data migration. Human applies to prod before Phase 2 ships (`payload-prod-migrate`).

## References

- Research: `context/changes/kosztorys-vat/research.md`
- Decisions: `context/changes/kosztorys-vat/change.md`
- Coeff-persistence template: `src/components/kosztorys/use-kosztorys-editor.ts:356-367`
- Computed-column mechanism: `src/lib/tables/kosztorys-v2-columns.tsx:96-110`
- Lessons: `context/foundation/lessons.md:98` (dsg column-freeze), `:112` (migration order)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema + query wiring (backend)

#### Automated

- [x] 1.1 Type checking passes: `pnpm exec tsc --noEmit` — ea9b438
- [x] 1.2 Lint passes: `pnpm lint` — ea9b438
- [x] 1.3 Migration applies cleanly on local DB: `pnpm payload migrate` — ea9b438
- [x] 1.4 Calc tests pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts` — ea9b438

#### Manual

- [ ] 1.5 Tree carries real `vatRate` (not 0) on a local investment
- [ ] 1.6 Payload admin shows VAT field, default 0.08
- [ ] 1.7 Human applies migration to prod before Phase 2 push

### Phase 2: Editor UI — brutto column, Suma brutto, in-editor rate input

#### Automated

- [x] 2.1 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 2.2 Lint passes: `pnpm lint`
- [x] 2.3 Build passes: `pnpm build`
- [x] 2.4 Calc tests pass with brutto assertion: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`

#### Manual

- [ ] 2.5 Netto 100.00 → Brutto 108.00; Suma brutto = Suma netto × 1.08
- [ ] 2.6 Brutto toggle hides/shows column + Suma brutto cleanly (remount key)
- [ ] 2.7 Editing VAT updates all brutto live and persists across reload
- [ ] 2.8 Brutto consistent across all three price views
- [ ] 2.9 No regressions to netto totals, coeffs, stages, autosave
