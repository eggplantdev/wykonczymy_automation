# Screaming Reconciliation Indicator Implementation Plan

> **Model revised in Phase 4 — net↔net, not gross↔gross.** The body below (Comparison basis,
> Phase 1–3 contracts, `ReconT` field names) records the ORIGINAL gross↔gross design. The shipped
> code compares kosztorys **client-view nets** against the raw transaction sums: the ledger carries no
> VAT axis, so grossing the kosztorys side would false-fire by the whole VAT amount. `ReconT` is
> `{ expected; actual; mismatch }` (no `…Gross` suffix, no `vatRate`); `buildKosztorysReconciliation`
> dropped `vatRate`. Read `src/lib/kosztorys/reconciliation.ts` as the authority, not this body.

## Overview

During the transition from manual `LABOR_COST`/`RABAT` transfers to reading robocizna/rabat from the
kosztorys, the owner needs to verify — per investment, by eye — that the two sources agree before
flipping that investment's "verified" flag. This plan builds that verification instrument on **two
surfaces**, both read-only, no writes, no schema change:

1. **Kosztorys editor Podsumowanie** — compare the investment's transaction-sourced robocizna/rabat
   against the kosztorys client-view figures and **scream on mismatch** (bold red figure + red `!` icon +
   explanatory tooltip).
2. **Investment detail page** — during the transition both robocizna values (transaction + kosztorys)
   and both rabat values are visible; the kosztorys-derived figure is shown in a **visually separated**
   „z kosztorysu" block with the same mismatch indicator, so it is obvious which number is which.

**Parity discipline:** the editor computes the kosztorys figure client-side (live rows), the investment
page server-side (persisted rows). Both call **one** shared pure function so the two planes cannot drift
(`lessons.md:19`). The listing-page aggregate is out of scope (the only heavy case — read-switch slice).

## Current State Analysis

- The kosztorys editor page (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:43`) already
  computes the full `financials` object via `deriveFinancials`. `totalLaborCosts` (Σ `LABOR_COST`) and
  `totalRabat` (Σ `RABAT`) sit on it but are **not read or threaded** into the editor. Both are the raw
  summed `amount` — no VAT applied anywhere (`investment-financials.ts:44,46`; the transfer schema has
  no vat field).
- „Suma prac wykonanych" at **client view** already exists in the hook: `doneNet`
  (`use-kosztorys-editor.ts:314`) = `sectionSubtotalsForView(rows, stages, 'client')` net, pre-rabat,
  view-independent. It is already returned from the hook (`:1027`).
- The current `rabatAmount` (`use-kosztorys-editor.ts:339`) is derived from the **active-view**
  `totalNet`/`subtotals`, so it moves with the price-view toggle — unusable for a fixed comparison.
- `toGross(net, vatRate)` exists (`src/lib/kosztorys/calc.ts:63`); `moneyPair` in `summary-economics.ts`.
- Tooltip primitive exists: `src/components/ui/tooltip.tsx` (and `info-tooltip.tsx`).
- Podsumowanie renders „Suma prac wykonanych" (`kosztorys-podsumowanie.tsx:120`) and the „Rabat" line
  (`:143`), the latter gated on `hasDiscount = rabatAmount > 0`.

## Desired End State

Opening the Podsumowanie on an investment whose kosztorys figures disagree with its `LABOR_COST` /
`RABAT` transfers shows the mismatched figure in **bold red with a red `!`**; hovering the `!` explains
what disagrees (kosztorys client-view gross vs the transaction sum) and by how much. When they agree
(to the grosz), the block renders exactly as today. Flipping the price-view toggle never changes the
verdict — the comparison is locked to client view. Verify: seed an investment where Σ `LABOR_COST` ≠
`toGross(„Suma prac wykonanych")`, open the panel, see the scream; correct the transfer, see it clear.

### Key Discoveries:

- `financials.totalLaborCosts` / `financials.totalRabat` are computed at `page.tsx:43` and just need
  threading — no new query.
- `doneNet` is the ready-made client-view executed net; only a client-view **rabat** net must be added.
- Transaction amounts are raw (net/gross-agnostic); the kosztorys side is grossed via `toGross`, so a
  historically net-typed transfer legitimately trips the `!` — that is the instrument working.

## What We're NOT Doing

- NOT changing where marża/bilans source robocizna/rabat (that is the later read-switch — separate).
- NOT adding the per-investment "verified/populated" flag or disabling the transfer types (later slices).
- NOT touching `deriveFinancials`, transfer collection, migrations, or the Sheets mirror.
- NOT showing a positive "match" affirmation — silent when equal, scream only on mismatch.

## Implementation Approach

Thread the two investment figures from the server page into `KosztorysEditorV2`. In the editor, which
already holds the hook's return and the server props, assemble a small `reconciliation` object (expected
kosztorys gross, actual transaction figure, mismatch flag) for robocizna and rabat, and pass it through
`KosztorysTotalsPanel` into `KosztorysPodsumowanie`, which renders the scream. The hook gains one figure
(client-view rabat net) alongside the existing `doneNet`.

## Critical Implementation Details

**Comparison basis (load-bearing).** Both figures compare **gross vs gross, client-view, tolerance one
grosz**. Kosztorys side = `toGross(clientNet, tree.vatRate)`; transaction side = the raw
`totalLaborCosts`/`totalRabat` (treated as gross). Tolerance is exact **grosz equality** on rounded
values — `Math.round(expected * 100) !== Math.round(actual * 100)` — not a fuzzy epsilon, so sub-grosz
`toGross` rounding never false-fires.

**Zero handling (confirmed).** Scream on any >1gr difference, INCLUDING kosztorys-nonzero vs
transaction-zero — that "transfer not entered yet" gap is the main thing population must catch. Both
sides zero ⇒ equal ⇒ silent.

**Force-show the rabat line (confirmed).** Today the „Rabat" row is gated on kosztorys `rabatAmount > 0`.
A `RABAT` transfer with an empty kosztorys rabat must still surface, so the row renders whenever EITHER
the kosztorys rabat OR the transaction rabat is non-zero (or a mismatch exists).

## Phase 1: Wire investment figures + client-view rabat, assemble reconciliation

### Overview

Get both sides of each comparison to meet in `KosztorysEditorV2`, and hand a ready-made verdict down to
the summary block.

### Changes Required:

#### 1. Server page threads the two investment figures

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Read `totalLaborCosts` and `totalRabat` off the already-computed `financials` and pass them
into the editor as the transaction-sourced robocizna/rabat.

**Contract**: Add props `investmentRobocizna={financials.totalLaborCosts}` and
`investmentRabat={financials.totalRabat}` to `<KosztorysEditorV2>`. No new fetch.

#### 2. Shared client-totals function (one path for both surfaces) + hook consumes it

**File**: `src/lib/kosztorys/settlement.ts` (new export) + `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: The kosztorys client-view figure will be computed on TWO surfaces — the editor (client-side,
live rows) and the investment page (server-side, persisted rows). To stop them drifting (the parity
lesson), extract ONE pure function both call. It returns the two nets the reconciliation needs:
`doneNet` (client-view executed net, pre-rabat) and `rabatClientNet` (the client-view rabat, view-independent).

**Contract**: `kosztorysClientTotals(rows: KosztorysV2RowT[], stages: KosztorysStageT[], globalDiscount)`
→ `{ doneNet: number; rabatClientNet: number }`, where `doneNet` = Σ `sectionSubtotalsForView(rows,
stages, 'client').net` and `rabatClientNet` = `globalDiscountAmount(doneNet, globalDiscount)` + Σ
`subtotals[].discount` (global discount and per-item rabat are mutually exclusive, so the sum is one or
the other). The hook replaces its inline `doneNet` (`:314`) and derives the new `rabatClientNet` from
this function over its already-memoized `'client'` `progressSubtotals` (`:310`), and returns
`rabatClientNet` alongside the existing `doneNet` (`:1027`). No behavior change to the hook's other outputs.

#### 3. Reconciliation assembly is a real lib module the surface actually calls

**File**: `src/lib/kosztorys/reconciliation.ts` (new) + `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Build the reconciliation in a pure module — NOT a colocated closure — so the parity test
exercises the exact function the surface renders (lessons.md: "A parity test must run the REAL
per-surface assembly"). The editor **body** (which owns the hook call — the shell `kosztorys-editor-v2`
is stateless and only forwards props) calls it with the hook figures + forwarded investment props and
passes the result to `KosztorysTotalsPanel`. Thread `investmentRobocizna`/`investmentRabat` through the
shell's and body's `PropsT`.

**Contract**: `buildKosztorysReconciliation({ doneNet, rabatClientNet, vatRate, investmentRobocizna,
investmentRabat })` → `{ robocizna: ReconT; rabat: ReconT }` where
`type ReconT = { expectedGross: number; actualGross: number; mismatch: boolean }`,
`expectedGross = toGross(clientNet, vatRate)`, `actualGross = investment{Robocizna|Rabat}`,
`mismatch = Math.round(expectedGross*100) !== Math.round(actualGross*100)`. `ReconT` exports from the
module (it's the cross-component contract the panel/podsumowanie props reuse).

#### 4. Totals panel forwards reconciliation

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: Pass-through only — accept `reconciliation` and forward it to `KosztorysPodsumowanie`.

**Contract**: Add `reconciliation` to `PropsT`; forward unchanged. No logic.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The editor renders unchanged (no visual delta yet) with the new props threaded.

---

## Phase 2: Render the scream in Podsumowanie

### Overview

Turn the reconciliation verdict into the bold-red-`!`-plus-tooltip UI on the „Suma prac wykonanych" and
„Rabat" rows.

### Changes Required:

#### 1. Podsumowanie renders the mismatch indicator

**File**: `src/components/kosztorys/kosztorys-podsumowanie.tsx`

**Intent**: Accept `reconciliation`; when a figure mismatches, render its value bold red and append a red
`!` icon whose tooltip states the kosztorys client-view gross, the transaction sum, and the delta. Apply
to the „Suma prac wykonanych" row (robocizna verdict) and the „Rabat" row (rabat verdict).

**Contract**: Add `reconciliation: { robocizna: ReconT; rabat: ReconT }` to `PropsT`. The row helper
gains a mismatch branch: red bold figure (`text-destructive font-bold`) + a small `!` (lucide
`TriangleAlert` / `CircleAlert`, `text-destructive`) wrapped in the `ui/tooltip` primitive. Force-render
the „Rabat" row when `rabatAmount > 0 || reconciliation.rabat.actualGross > 0 || reconciliation.rabat.mismatch`
(replacing the bare `hasDiscount` gate).

#### 2. Tooltip copy

**File**: `src/components/kosztorys/kosztorys-podsumowanie.tsx` (same change)

**Intent**: A short Polish explanation so the owner knows what disagrees and by how much.

**Contract**: e.g. „Kosztorys (brutto, ceny klienta): {expected}. Transakcje robocizny: {actual}.
Różnica: {delta}. Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej." (rabat variant swaps the
noun). English code comment explains the why per repo convention.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-reconciliation.test.ts`

#### Manual Verification:

- Mismatch scream (robocizna): on an investment where Σ `LABOR_COST` ≠ `toGross(client „Suma prac wykonanych")`, the „Suma prac wykonanych" figure renders bold red with a red `!` icon.
- Tooltip content (robocizna): hovering the `!` shows the kosztorys figure (brutto, ceny klienta), the transaction sum, and the różnica.
- Mismatch scream (rabat): on an investment where Σ `RABAT` ≠ the kosztorys rabat (gross), the „Rabat" figure screams the same way, with its own tooltip.
- Missing-transfer gap: kosztorys has executed work but NO `LABOR_COST` transfer exists → robocizna screams (the "transfer not entered yet" case).
- Hidden-rabat gap: a `RABAT` transfer exists but the kosztorys rabat is 0 → the „Rabat" row force-shows and screams (it must not stay hidden).
- Match is silent: when both figures agree to the grosz, the Podsumowanie renders exactly as before — no red, no `!`, no extra rabat row (when kosztorys rabat is 0 and no `RABAT` transfer exists).
- View stability: toggling client ↔ subcontractor price view changes neither verdict.
- Axis stability: switching the netto/brutto money-axis keeps the scream on the same rows.
- Live reaction: editing a stage quantity in the grid (unsaved) updates the kosztorys side of the comparison immediately — a match can break or heal live.
- Zero-VAT case: on an investment with `vatRate = 0`, matching net-entered transfers stay silent (gross ≡ net).
- Collapsed panel unaffected: the collapsed „Do zapłaty" headline renders unchanged; the scream lives only in the expanded Podsumowanie.

---

## Phase 3: Investment-page dual display (visually separated) + mismatch

### Overview

Surface the kosztorys-derived robocizna/rabat on the investment detail page next to the transaction
figures, visually separated, with the same mismatch indicator. This is the second verification surface
and the first server-side read of the kosztorys figure — through the SAME `kosztorysClientTotals` +
`buildKosztorysReconciliation` the editor uses, so the two planes can't disagree.

### Changes Required:

#### 1. Server page derives the kosztorys figure for the investment

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: When the investment has a kosztorys, load its rows once and compute the client-view gross
robocizna/rabat server-side; otherwise render exactly as today (no second block).

**Contract**: Load the tree via the existing server helper (`getKosztorysTree(investmentId)` →
flatten rows, as `serialize-kosztorys.ts` does) — reuse that flatten path, do not re-roll it. Feed
`kosztorysClientTotals(rows, stages, globalDiscount)` → `{ doneNet, rabatClientNet }`, then
`buildKosztorysReconciliation({ doneNet, rabatClientNet, vatRate, investmentRobocizna:
financials.totalLaborCosts, investmentRabat: financials.totalRabat })`. Pass the resulting
`{ robocizna, rabat }` verdict (each carrying `expectedGross`) into `FinancialStats`. When no kosztorys
rows exist, pass `undefined` — the block is skipped. No new marża/bilans sourcing (still transactions).

#### 2. FinancialStats shows a separated „z kosztorysu" figure

**File**: `src/components/investments/financial-stats.tsx` (+ a small presentational child if it reads cleaner)

**Intent**: Next to (or under) the existing Robocizna and Rabat rows, render the kosztorys-derived gross
value in a visually distinct block labelled „z kosztorysu", carrying the red `!` + tooltip when it
mismatches the transaction figure. Distinct enough that it is never confused with the transaction total.

**Contract**: Accept an optional `reconciliation?: { robocizna: ReconT; rabat: ReconT }` prop (the same
`ReconT` from `reconciliation.ts`). For each of robocizna/rabat, when present render a secondary line/badge
`z kosztorysu: {formatPLN(expectedGross)}` with muted styling that clearly differs from the primary
figure; on `mismatch`, the secondary value is bold red with the `!` + tooltip (kosztorys gross vs
transaction sum + różnica). Absent prop ⇒ identical to today.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- On an investment with a matching kosztorys: the „z kosztorysu" robocizna/rabat show, visually
  separated from the transaction figures, no red, no `!`.
- On a mismatching investment: the „z kosztorysu" figure is bold red with a red `!`; tooltip names both
  figures + różnica. Same for rabat.
- On an investment with NO kosztorys: the page renders exactly as today — no second block, no error.
- The kosztorys figure on the investment page equals the „Suma prac wykonanych" / „Rabat" the editor's
  Podsumowanie shows for the same investment (same plane, same number — parity by eye).
- Marża/Bilans are unchanged (still transaction-sourced) — this slice only _displays_ the kosztorys figure.

---

## Phase 4: Browser E2E — seeded sync verification (both surfaces)

### Overview

The layer the unit/parity tests cannot reach: prove the **wired surfaces** show the right verdict on
real seeded data. Catches prop-plumbing mistakes (active-view `totalNet` fed where client-view
`doneNet` belongs; wrong financials field passed; the two surfaces reading different planes) that stay
invisible to green unit tests — the exact "two planes, both green, still disagreeing" failure the parity
lesson records.

### Changes Required:

#### 1. E2E spec

**File**: `e2e/kosztorys-reconciliation.spec.ts` (follow the harness conventions in `e2e/`)

**Intent**: Against the isolated 5435 `db-test` DB, seed via API/Local-API and assert the verdict on
BOTH surfaces.

**Contract**: (a) mismatch — investment with kosztorys executed work and a deliberately different
`LABOR_COST` sum → editor Podsumowanie shows the `!` on „Suma prac wykonanych" AND the investment page's
„z kosztorysu" robocizna screams, both tooltips naming both figures; (b) match — `LABOR_COST` sum set to
exactly the client executed net (netto ↔ netto — the ledger plane carries no VAT, so no `toGross`) →
neither surface screams; (c) parity — the kosztorys figure on
the investment page equals the editor's Podsumowanie figure for that investment; (d) stability — on the
mismatch investment, toggle the editor price view → the indicator remains. Seeding follows the existing
E2E fixture pattern (reset with `pnpm db:import:test`).

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `pnpm test:e2e`

#### Manual Verification:

- (none — this phase is the automation of the sync checks)

---

## Testing Strategy

Shaped by the parity lesson (`lessons.md:19`): a sync check between two planes must run the **real
per-surface assembly on both sides**, never a stand-in, and must be **proven red** before green is
trusted. The prior failure mode — `extractFigures ↔ extractFigures` staying green while real pages
disagreed by hundreds of zł — is exactly what a "pure helper with fabricated inputs" test would
reproduce here.

### Unit/Parity Tests (`src/__tests__/kosztorys-reconciliation.test.ts`):

- **Tolerance cases through the real helper** (`buildKosztorysReconciliation`, the function the body
  calls): equal-to-grosz ⇒ silent; 1-grosz-over ⇒ mismatch; kosztorys-nonzero vs transaction-zero ⇒
  mismatch; both-zero ⇒ silent; sub-grosz `toGross` rounding ⇒ no false mismatch.
- **Cross-boundary parity on real assemblies**: build a realistic row fixture (multiple sections/etapy,
  per-item rabat AND a global-discount variant); compute the kosztorys side via the REAL chain the hook
  uses — `sectionSubtotalsForView(rows, stages, 'client')` → `globalDiscountAmount` → the helper's
  `toGross` — and the transaction side via the REAL `deriveFinancials` over a matching
  `LABOR_COST`/`RABAT` type-distribution. Assert: constructed-equal ⇒ no mismatch on either figure;
  perturb the transfer side by 1 grosz ⇒ mismatch. No hand-computed expected constants on the kosztorys
  side — the settlement chain IS the expectation.
- **Legacy-shaped fixture cases** (the old lesson bit on legacy rows a clean fixture missed):
  zero-quantity stages on some rows; per-item rabat and global discount exercised as separate variants
  (mutually exclusive by construction); a `vatRate = 0` variant (gross ≡ net must stay silent on
  net-entered transfers).
- **Red proof (dev-time, mandatory)**: before finishing, break the real path (e.g. feed the pre-rabat
  `doneNet` where the post-rabat figure belongs, or drop the `toGross`) and confirm the parity test
  fails; restore and confirm green. A test that has only ever been green is presumed tautological.

### Browser E2E (Phase 4 — authored in this slice, not deferred):

- The parity test proves the _functions_ agree; it cannot catch prop-plumbing mistakes (body feeding
  active-view `totalNet` instead of client-view `doneNet`; page passing the wrong financials field; the
  two surfaces reading different planes). That "green tests, real surfaces disagree" gap is exactly the
  lesson's failure shape, so the E2E is in-slice and covers BOTH surfaces: seeded mismatch → `!` visible
  on editor Podsumowanie AND investment page; seeded match → both silent; investment-page figure equals
  editor figure (cross-surface parity); price-view toggle → verdict stable.

### Manual Testing Steps:

See Phase 2 `#### Manual Verification:` — the complete checklist lives there and is aggregated into
`context/foundation/manual-checks.md` at the end of the change.

## Performance Considerations

Negligible — two extra numbers threaded, one extra client-view memo (reusing the already-computed
`progressSubtotals`), one comparison. Nothing touches the render-hot grid path.

## Migration Notes

None. Read-only; no schema, no data change. Kosztorys data is throwaway pre-dogfooding.

## References

- Research: `context/changes/robocizna-from-kosztorys/research.md`
- Change brief: `context/changes/robocizna-from-kosztorys/change.md`
- Client-view executed net: `src/components/kosztorys/use-kosztorys-editor.ts:314`
- Transaction sums: `src/lib/db/investment-financials.ts:44,46`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wire investment figures + client-view rabat, assemble reconciliation

#### Automated

- [x] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` — 13a81a1f
- [x] 1.2 Linting passes: `pnpm lint` — 13a81a1f

### Phase 2: Render the scream in Podsumowanie

#### Automated

- [x] 2.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` — 8a00f85b
- [x] 2.2 Linting passes: `pnpm lint` — 8a00f85b
- [x] 2.3 Unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-reconciliation.test.ts` — 8a00f85b

### Phase 3: Investment-page dual display (visually separated) + mismatch

#### Automated

- [x] 3.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [x] 3.2 Linting passes: `pnpm lint`

### Phase 4: Browser E2E — seeded sync verification (both surfaces)

#### Automated

- [x] 4.1 E2E suite passes: `pnpm test:e2e`
