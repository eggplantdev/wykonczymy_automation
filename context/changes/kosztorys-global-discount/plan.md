# Global Discount on Kosztorys — Implementation Plan

## Overview

Add one two-mode (percent / amount) **global discount** ("rabat za całość wykonanych prac") per
kosztorys. When set it **overrides** every per-item discount (their columns hide and their
contribution stops counting), and it is subtracted **once** from the executed total —
`wartość netto wykonanych prac − rabat globalny = do zapłaty`. It does not distribute to sections or
stages. Per-item discount data stays in the DB and returns when the global discount is cleared.

The discount base is the **executed** total ("wartość netto wykonanych prac"), because that is the
amount the client actually pays — the client pays for executed work, not for the przedmiar. The
przedmiar figure is only a preview. Both modes (percent and amount) reduce the same executed total;
there is no per-mode split.

Margin stays **out of scope**: kosztorys v2 and the financial ledger are deliberately disconnected
today (verified — no writer/reader between them), so a kosztorys discount cannot and should not move
`marża` in this change.

## Current State Analysis

- **Per-item discount** is already two-mode. `DiscountTypeT = 'percent' | 'amount'`
  (`src/types/kosztorys.ts:8`); fields `discountType` / `discountValue`
  (`src/types/kosztorys.ts:31-32`); single application point `applyDiscount`
  (`src/lib/kosztorys/calc.ts:17-21`), through which **every** net figure passes via
  `netForQtyForView` (`calc.ts:60-63`).
- **Per-investment settings** (`w_tools_coeff`, `own_tools_coeff`, `vat_rate`) are the exact
  precedent for a global discount: a column on `investments`
  (`src/collections/investments.ts:79-104`), read in `getKosztorysTree`
  (`src/lib/queries/kosztorys.ts:62-66,132`), denormalized onto every row
  (`src/lib/kosztorys/v2-rows.ts:67-72`), mutated by an investment-level action mirroring
  `updateInvestmentVatAction` (`src/lib/actions/kosztorys.ts:105-119`), optimistically patched onto
  rows in the editor hook (`use-kosztorys-editor.ts:476-483`, `patchRows` at `:447-455`).
- **Executed total is computed once** in the editor hook: `sectionSubtotalsForView`
  (`v2-rows.ts:387-414`) → `subtotals` → `totalNet` (`use-kosztorys-editor.ts:173-181`). It already
  feeds **both** the Sekcje panel Suma block (`kosztorys-section-summary.tsx:224-233`, `grandNet`) and
  the progress counter — this is the single source both total surfaces must share.
- **Column visibility** already has three stacked conditions in one filter
  (`kosztorys-v2-columns.tsx:765-775`); the discount columns are `discountValue`, `discountType`,
  `discountAmount`, `discountAmountGross` (`:617-632`); the picker list is built from the same
  `assembleV2Columns` (`:779-787`).
- **Snapshot** captures the three investment settings as an additive block
  (`snapshot-format.ts:15-19`), serialized in `serialize-kosztorys.ts:20-24` and rewritten on restore
  (`restore-kosztorys.ts:105-107`). Adding two fields is additive — no schema-version bump.
- **No total/"suma" surface exists under the grid.** Today the only whole-kosztorys figures live in
  the Sekcje panel Suma block and the toolbar progress counter. The persistent totals bar is net-new.

### Key Discoveries:

- The global discount is architecturally a fourth per-investment setting — it rides the exact
  `vat_rate` rail end to end (collection → migration → tree → denormalize → action → optimistic patch).
- **Override is a per-row suppression, not a delete.** A denormalized boolean flag on each row makes
  `applyDiscount` return the pre-discount value when the global discount is active; per-item
  `discountType`/`discountValue` stay untouched in the DB and resume the moment the flag flips off.
- **"Nic się nie rozkłada"**: section rows and stage-value columns show gross-of-discount when the
  global discount is active (per-item suppressed, global not distributed); the global discount appears
  as a **single line** only in the total ("do zapłaty").
- Discount is entered **netto** (every price in this editor is netto — see the VAT tooltip,
  `kosztorys-global-settings.tsx:15-18`); brutto follows via VAT applied post-discount, consistent
  with `toGross` on the post-discount net (`calc.ts:46-53`).

## Desired End State

On a kosztorys, the settings bar carries a discount control (mode toggle percent/amount + value)
beside VAT and the coefficient. Setting it:

1. Hides all four discount columns and drops them from the column picker.
2. Suppresses per-item discounts in every row/section/stage figure (they show gross-of-discount).
3. Subtracts the discount once from the executed total.

Two surfaces show the result from **one** computed source: the Sekcje panel Suma block (now `Suma
· − Rabat · = Do zapłaty`, netto+brutto) and a new persistent totals bar under the grid. Clearing the
discount restores per-item discounts and their columns with no data loss. A snapshot round-trips the
discount; a restore rewrites it.

Verify: enter a percent then an amount discount → columns hide, both total surfaces show identical
`do zapłaty`, per-row figures go gross-of-discount; clear it → per-item discounts and columns return;
snapshot + restore preserves the discount; `marża` on the investment card is unchanged (out of scope,
by design).

## What We're NOT Doing

- **Not touching margin** or any transfer (`RABAT`, `LABOR_COST`) — kosztorys↔ledger wiring is a
  separate, parked decision (P5, `kosztorys-editor-domain-notes.md:343`).
- **Not touching per-item discount behavior** on the przedmiar/offer figure (EX-495 stays as-is:
  rabat in the offer is a valid preview).
- **Not distributing** the discount across sections or stages.
- **Not touching the export / offer PDF** — the global discount in the export is a later step, if at
  all; the frame did not scope it.
- **No data-preservation path** for existing kosztorys rows — throwaway until dogfooding merges
  (AGENTS.md); the migration adds columns with defaults and nothing needs backfilling.

## Implementation Approach

Ride the `vat_rate` rail for the model and mutation; add a denormalized `globalDiscountActive` flag so
the pure pricing layer suppresses per-item discounts without knowing about investments; compute the
discount amount and `do zapłaty` **once** in the editor hook next to `totalNet`; render both total
surfaces from those props. Column hiding is a fourth condition in the existing visibility filter.

## Critical Implementation Details

- **Single total source (hard constraint).** The discount amount and `do zapłaty` are computed once in
  `use-kosztorys-editor.ts` from the existing `totalNet`. The Sekcje panel Suma block and the new
  totals bar both consume those values as props — neither recomputes. This is the whole point of the
  owner's "to samo źródło danych".
- **Override ordering.** `applyDiscount` must short-circuit on the denormalized flag _before_ reading
  `discountType`, so a row with a stored per-item discount renders gross while the global discount is
  active. The `> 0` qty guards in `netForQtyForView` are unaffected.
- **VAT after discount.** The discount subtracts at the netto level; brutto `do zapłaty` = `(totalNet −
rabat) × (1 + vatRate)`, matching how per-item discounts already precede VAT.

## Phase 1: Model, read path, snapshot

### Overview

Persist the discount on `investments`, carry it on the tree, and round-trip it through snapshots.

### Changes Required:

#### 1. Investments collection

**File**: `src/collections/investments.ts`

**Intent**: Add the two discount fields beside `vatRate`, mirroring the per-item discount shape.

**Contract**: `globalDiscountType` (`type: 'text'`, nullable — holds `'percent' | 'amount' | null`)
and `globalDiscountValue` (`type: 'number'`, `required`, `defaultValue: 0`). Polish/English labels
like the neighbours.

#### 2. Migration

**File**: `src/migrations/20260716_1_add_global_discount_to_investments.ts` (new; register in
`src/migrations/index.ts` after `20260716_0`)

**Intent**: Hand-write the columns (AGENTS.md — no auto-generated migrations), mirroring
`20260710_0_add_vat_rate_to_investments.ts`.

**Contract**: `up`: `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "global_discount_type" text;`
and `ADD COLUMN IF NOT EXISTS "global_discount_value" numeric NOT NULL DEFAULT 0;`. `down` drops both.

#### 3. Tree type + read

**Files**: `src/types/kosztorys.ts`, `src/lib/queries/kosztorys.ts`

**Intent**: Add the discount to `KosztorysTreeT` and populate it in `getKosztorysTree` from the
investment record.

**Contract**: `KosztorysTreeT.globalDiscount: { type: DiscountTypeT | null; value: number }`.
`getKosztorysTree` maps `investment.globalDiscountType` / `globalDiscountValue` (null type, numeric
value via the existing `num` helper).

#### 4. Snapshot

**Files**: `src/lib/kosztorys/snapshot-format.ts`, `serialize-kosztorys.ts`, `restore-kosztorys.ts`

**Intent**: Add the two fields to the snapshot settings block (additive — no `SNAPSHOT_SCHEMA_VERSION`
bump), serialize them from the tree, rewrite them on restore.

**Contract**: `SnapshotSettingsT` gains `globalDiscountType: DiscountTypeT | null` and
`globalDiscountValue: number`; `serializeKosztorys` reads them off `tree.globalDiscount`;
`restoreKosztorys` writes them onto the investment alongside `vatRate` — defaulting a missing field
(tolerant deserialization) so pre-existing snapshots still restore.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Migration applies cleanly against local docker Postgres: `pnpm payload migrate`
- Build passes: `pnpm build`

#### Manual Verification:

- A fresh investment reads `globalDiscount` = `{ type: null, value: 0 }` in the editor with no errors.

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 2.

---

## Phase 2: Pricing override + total (TDD)

### Overview

Suppress per-item discounts when the global discount is active, and compute the discount amount and
`do zapłaty` in the pure layer. Pure functions — test-first.

### Changes Required:

#### 1. Denormalize the active flag onto rows

**Files**: `src/types/kosztorys.ts`, `src/lib/kosztorys/v2-rows.ts`

**Intent**: Carry a boolean the pricing layer can read per row, denormalized like `vatRate`.

**Contract**: `KosztorysV2RowBaseT` and `ViewPricingT` gain `globalDiscountActive: boolean`.
`treeToRows` and `buildBlankRow` set it from `tree.globalDiscount` (active =
`globalDiscount.type != null && globalDiscount.value > 0`).

#### 2. Override in `applyDiscount`

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Return the pre-discount value when the global discount is active, before reading the
per-item type — leaving per-item fields untouched.

**Contract**: `applyDiscount(gross, item)` first branch: `if (item.globalDiscountActive) return gross`.
No signature change (the flag rides on `ViewPricingT`).

#### 3. Discount amount + `do zapłaty`

**File**: `src/lib/kosztorys/calc.ts` (or a small total-level helper)

**Intent**: One function turning the executed total into the discount amount, and the payable net.

**Contract**: `globalDiscountAmount(totalNet: number, discount: { type; value }): number` — `percent` →
`totalNet * value / 100`, `amount` → `value`, else `0`. Callers compute `doZaplatyNet = totalNet −
globalDiscountAmount(...)`. Not clamped below zero unless a test shows a need.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- Type checking passes: `pnpm exec tsc --noEmit`

Tests to add (assert behavior, not implementation):

- Global active ⇒ a row with a stored per-item `percent`/`amount` discount prices gross on **both**
  the offer (`rowPlannedNetForView`) and executed (`rowValueForView`) figures.
- `globalDiscountAmount`: percent scales the total; amount is flat; null/zero ⇒ 0.
- `doZaplatyNet` = `totalNet − amount`.

#### Manual Verification:

- None (pure layer) — covered by unit tests.

**Implementation Note**: Pause for confirmation before Phase 3.

---

## Phase 3: Action, editor wiring, column hiding

### Overview

Persist the discount via an investment-level action, wire optimistic state into the editor hook, and
hide the discount columns when the global discount is active.

### Changes Required:

#### 1. Action + schema

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Mirror `updateInvestmentVatAction` for the discount.

**Contract**: `investmentGlobalDiscountSchema = z.object({ globalDiscountType: z.enum(['percent',
'amount']).nullable(), globalDiscountValue: z.coerce.number().min(0) })`;
`updateInvestmentGlobalDiscountAction(investmentId, patch)` validates, `payload.update` on
`investments`, revalidates `['kosztorysItems']` (the flag is denormalized onto items only).

#### 2. Editor hook

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Hold discount state, optimistically patch the denormalized flag onto rows (as
`handleVatChange` does for `vatRate`), compute the amount + `do zapłaty` next to `totalNet`, expose a
handler and the totals.

**Contract**: derive `globalDiscount` from `tree`; `handleGlobalDiscountChange(patch)` → `patchRows`
setting `globalDiscountActive` + `updateInvestmentGlobalDiscountAction` + `router.refresh()`;
`useMemo` `globalDiscountAmount` and `doZaplatyNet` from `totalNet`. Add to the returned object (and
the editor context) so both total surfaces read one source.

#### 3. Column hiding

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Fourth visibility condition — drop the four discount columns from the grid and the picker
when the global discount is active.

**Contract**: `BuildV2ColumnsOptsT` gains `globalDiscountActive?: boolean`; `buildV2Columns`'s filter
excludes `discountValue`/`discountType`/`discountAmount`/`discountAmountGross` when active;
`buildV2ToggleItems` skips the same ids. `columnOpts` in the hook passes the flag.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Build passes: `pnpm build`
- Unit tests pass: `pnpm exec vitest run`

#### Manual Verification:

- Setting a discount in the DB (or via the Phase 4 control) hides the four discount columns and drops
  them from the picker; clearing it brings them back.

**Implementation Note**: Pause for confirmation before Phase 4.

---

## Phase 4: UI — discount control + two total surfaces

### Overview

Add the discount control to the settings bar and render `do zapłaty` in both the Sekcje panel Suma
block and a new persistent totals bar under the grid — both from the hook's single source.

### Changes Required:

#### 1. Discount control

**Files**: `src/components/kosztorys/kosztorys-global-settings.tsx` (+ its render site
`kosztorys-editor-toolbar.tsx`)

**Intent**: A mode toggle (percent/amount) + a value field beside VAT and the coefficient; clearing
the value (or an "off" state) removes the discount.

**Contract**: new props `globalDiscount: { type: DiscountTypeT | null; value: number }` and
`onGlobalDiscountChange`. Value entered netto. A tooltip states it overrides per-item discounts and
reduces the executed total.

#### 2. Sekcje panel Suma block

**File**: `src/components/kosztorys/kosztorys-section-summary.tsx`

**Intent**: Extend the existing Suma block to `Suma · − Rabat · = Do zapłaty` (netto + brutto) when a
discount is set; unchanged when none.

**Contract**: new props for the discount amount and `doZaplatyNet` (from the hook). Brutto uses the
existing `× (1 + vatRate)`. No local recomputation.

#### 3. Persistent totals bar

**Files**: new `src/components/kosztorys/kosztorys-totals-bar.tsx`; render under the grid in
`kosztorys-editor-body.tsx`

**Intent**: A preliminary always-visible bar under the grid showing the same figures as the Sekcje
Suma block, honoring the netto/brutto axis toggle.

**Contract**: props = `totalNet`, discount amount, `doZaplatyNet`, `vatRate`, `moneyAxis` — all from
the hook. Pure render, no math beyond `toGross`/axis selection. Shares the source with the Sekcje
panel by construction.

### Success Criteria:

#### Automated Verification:

- Build passes: `pnpm build`
- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Enter a **percent** discount → columns hide, per-row figures go gross-of-discount, both the Sekcje
  Suma block and the totals bar show identical `do zapłaty`, netto/brutto toggle applies to both.
- Enter an **amount** discount → same, amount subtracted flat once.
- Clear the discount → per-item discounts and their columns return; totals revert.
- Snapshot then restore a discounted kosztorys → discount preserved.
- Investment card `marża` unchanged (out of scope, by design).

**Implementation Note**: Final phase — `/10x-implement` aggregates these manual checks into
`context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests (Phase 2, `src/__tests__/kosztorys-calc.test.ts`):

- Override suppresses per-item discount on both offer and executed figures.
- `globalDiscountAmount` percent / amount / null.
- `doZaplatyNet` = executed total − amount.

### Manual Testing Steps:

The Phase 4 manual list is the acceptance script (percent, amount, clear, snapshot/restore, margin
unchanged).

## Migration Notes

Hand-written per AGENTS.md. Two additive columns with defaults; no backfill (kosztorys data is
throwaway pre-dogfooding). Apply locally with `pnpm payload migrate`; prod is a human step
(`pnpm db:migrate:prod`) owed only when the code ships.

## References

- Frame brief: `context/changes/kosztorys-global-discount/frame.md`
- Change identity + domain archaeology: `context/changes/kosztorys-global-discount/change.md`
- VAT precedent (the rail this rides): `investments.ts:97-104`, `queries/kosztorys.ts:132`,
  `actions/kosztorys.ts:105-119`, `use-kosztorys-editor.ts:476-483`
- Single-source totals: `use-kosztorys-editor.ts:173-181`, `kosztorys-section-summary.tsx:224-233`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Model, read path, snapshot

#### Automated

- [x] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [x] 1.2 Migration applies cleanly against local docker Postgres: `pnpm payload migrate`
- [x] 1.3 Build passes: `pnpm build`

### Phase 2: Pricing override + total (TDD)

#### Automated

- [ ] 2.1 Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- [ ] 2.2 Type checking passes: `pnpm exec tsc --noEmit`

### Phase 3: Action, editor wiring, column hiding

#### Automated

- [ ] 3.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 3.2 Build passes: `pnpm build`
- [ ] 3.3 Unit tests pass: `pnpm exec vitest run`

### Phase 4: UI — discount control + two total surfaces

#### Automated

- [ ] 4.1 Build passes: `pnpm build`
- [ ] 4.2 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 4.3 Lint passes: `pnpm lint`
