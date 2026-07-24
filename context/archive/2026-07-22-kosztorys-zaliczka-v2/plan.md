# Materiały netto/brutto in Podsumowanie (slice A) — Implementation Plan

## Overview

Today „Materiały" enters the kosztorys **Podsumowanie** as a no-VAT figure (netto === brutto, via
`faceValue`). That is wrong: materiały are recorded as **brutto** transactions (VAT already inside).
This slice makes „Materiały" respect netto/brutto by deriving netto from the brutto amount
(`netto = brutto / (1+VAT)`) — the **inverse** of robocizna, where netto is native and brutto is
grossed up. The split flows through the whole waterfall (pozycja Materiały → Łącznie → Do zapłaty), and
a visible hint makes the VAT direction explicit (here VAT is subtracted, unlike robocizna).

## Current State Analysis

- `src/lib/kosztorys/summary-economics.ts` has three money constructors: `moneyPair(net, vat)`
  (net-native, `gross = net×(1+vat)` — the prace shape), `faceValue(net)` (no-VAT, `gross === net`),
  and no gross-native constructor. `computeSummarySplit` and `computeDoZaplatyRM` both take
  `materialyNet` and treat it as face value — grossing only robocizna.
- The materiały amount is a **server prop** sourced from `financials.totalMaterialCosts` (a plain sum
  of unsettled expense transaction totals — `src/lib/db/investment-financials.ts:41`). We do **not**
  touch that layer; we reinterpret the value at the presentation boundary.
- The per-category split (`buildMaterialyBreakdown` → `MaterialyBreakdownRowT[]`, field `net`) sums to
  `totalMaterialCosts`. The `id: null` row is the **uncategorised materiały remainder**, not korekta
  (`src/types/investment-financials.ts:20`) — so every breakdown row is materiały, uniform brutto
  treatment, no special case.
- The materiały category rows render via `summaryLineFace(item.net, combinedNet)` with `noBrutto`
  (`summary-breakdown-table.tsx:69`), which shows an „Pozycja bez VAT" info tooltip and repeats netto in
  the brutto column. Both stop being true once materiały carry real VAT.
- The prop is inconsistently named across the chain: `materialsNet` at
  page/query/editor-body/editor-v2/`lib/kosztorys/types.ts`, then renamed mid-chain to `materialyNet`
  (a half-translated identifier, banned by the glossary) at panel/summary/economics. Since the
  net→gross semantic change touches exactly these identifiers, we unify them to `materialsGross`.

### Key Discoveries:

- `summary-economics.ts:45-60` (`computeSummarySplit`) and `:67-78` (`computeDoZaplatyRM`) are the two
  waterfall math sites; both must derive materiały netto from gross.
- `summary-breakdown-table.tsx:52-73` renders category rows — needs `vatRate` (not currently passed)
  and a gross-native pair per row.
- `summary-grid.tsx` `SummaryRow` `noBrutto` opt (`:106`, `:153-160`, `:167`) is the current bez-VAT
  hint mechanism; materiały rows drop it and instead get a formula hint.
- Prop chain to rename `materialsNet`/`materialyNet` → `materialsGross`: `page.tsx:65,88`,
  `client-kosztorys.ts:56`, `lib/kosztorys/types.ts:126`, `kosztorys-editor-v2.tsx:22,67`,
  `kosztorys-editor-body.tsx:45,217`, `kosztorys-totals-panel.tsx:54,88,108,184`,
  `kosztorys-summary.tsx:39,40,75,91`, `summary-economics.ts` params.
- Existing unit test home: `src/__tests__/lib/kosztorys/summary-economics.test.ts`.

## Desired End State

In the Podsumowanie, with the panel axis on **Netto**, „Materiały" (and every materiały category row,
Łącznie, and Do zapłaty) shows `brutto / (1+VAT)`; on **Brutto** it shows the raw transaction amount.
The netto/brutto columns of the materiały rows differ by exactly the VAT, and a hint next to the
materiały rows states the formula (`netto = brutto − VAT`), signalling the inverted direction vs
robocizna. Łącznie and Do zapłaty are internally consistent with the rows above them in both axes.
Verify: unit tests on the three economics functions pass; manual check of the panel in Netto and Brutto
axes shows the derived figures and the hint.

## What We're NOT Doing

- **Not touching** `investment-financials.ts`, `calculate-balance.ts`, `calculate-margin.ts`, or the
  transactions model. The Podsumowanie will **no longer reconcile** with the investment page's flat
  materiały sum — this is accepted and intended (owner), fixed in the later persistence slice.
- **No** per-investment netto/brutto flag and **no** cash-settlement input — materiały are always
  treated as brutto here. Flag + cash + persistence are slice B / the persistence slice.
- **Not** renaming the financials-layer `MaterialyBreakdownRowT.net` field or `totalMaterialCosts`
  (they live in the scope-locked layer) — we reinterpret `item.net` as gross at the presentation
  boundary with a comment, and note the field-name debt for the persistence slice.
- **No** broader `materialy*` naming crusade — only the identifiers the net→gross change already touches
  are unified to `materialsGross`.

## Implementation Approach

Add one gross-native money constructor mirroring `moneyPair`, thread the materiały amount as **gross**
through the two waterfall functions (deriving netto internally), and update the two rendering surfaces
(the category breakdown rows + the shared row hint). Rename the prop chain to `materialsGross` so the
identifier stops lying. Unit-test the pure economics functions.

## Critical Implementation Details

- **`kosztorys-totals-panel.tsx` may carry parallel in-flight work** (the moneyAxis / Mieszana
  ToggleGroup). Before editing it, re-check `git status`; if it's dirty from another session, stage
  **only** the lines this change adds and never `git add` the whole file. The rename still applies —
  just land it carefully.
- **Rounding**: `netto = brutto/(1+VAT)` is non-terminating; rely on the existing `formatNet` display
  rounding (no new rounding rule). Σ per-category netto equals the total netto exactly because division
  by `(1+VAT)` distributes over the sum — no reconciliation drift beyond display rounding.

## Phase 1: Materiały as brutto through the waterfall + formula hint

### Overview

Introduce the gross-native constructor, make both waterfall functions materiały-VAT-aware, render the
breakdown rows and Łącznie/Do zapłaty from the derived pair, add the formula hint, and unify the prop
name. One phase (economics + UI + rename), with unit tests as the automated boundary.

### Changes Required:

#### 1. Gross-native money constructor + waterfall math

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: Add the missing inverse of `moneyPair` for gross-native figures (materiały), and make the
two waterfall functions take the materiały amount as **gross**, deriving netto internally. This is the
core of the slice — every downstream figure reads correctly once this is right.

**Contract**:

- New `export function grossPair(gross: number, vatRate: number): MoneyPairT` returning
  `{ net: gross / (1 + vatRate), gross }`. Doc it as the materiały counterpart to `moneyPair`: netto is
  derived by removing VAT, the inverse direction vs prace.
- `computeSummarySplit(laborCostsNetFromKosztorys, materialsGross, vatRate)`: build
  `const materialy = grossPair(materialsGross, vatRate)`; `combinedNet = laborCostsNet + materialy.net`;
  `combined.gross = laborCosts.gross + materialy.gross`. (Rename the param `materialyNet` →
  `materialsGross`.)
- `computeDoZaplatyRM(laborCostsNetFromKosztorys, wplatyNet, materialsGross, vatRate)`: with
  `materialy = grossPair(materialsGross, vatRate)`, `net = laborCostsNet − wplatyNet + materialy.net`
  and `gross = toGross(laborCostsNet, vatRate) − wplatyNet + materialy.gross`. Update the doc comment
  (materiały enter at their derived netto/gross, not face value).

#### 2. Breakdown rows render from the derived pair + formula hint

**File**: `src/components/kosztorys/summary-breakdown-table.tsx`

**Intent**: Each materiały category row shows real netto (`item.net` is gross → derive) and real brutto,
drop the bez-VAT treatment, and carry the formula hint. Reinterpret `item.net` as gross locally (the
financials field keeps its name).

**Contract**:

- Add a `vatRate: number` prop (threaded from `kosztorys-summary.tsx`).
- Replace `line={summaryLineFace(item.net, combinedNet)}` with a gross-derived line: build the pair via
  `grossPair(item.net, vatRate)` and its udział `share = derivedNet / combinedNet` (0 when
  `combinedNet` is 0). A small local helper or an extended `summaryLine*` — keep it colocated; do not
  add a financials-layer function.
- Remove `noBrutto` from the materiały rows; add the formula hint (see change #3). Add a comment that
  `item.net` is the brutto transaction sum reinterpreted here (field-rename debt deferred).

#### 3. Formula hint on materiały rows

**File**: `src/components/kosztorys/summary-grid.tsx`

**Intent**: Give `SummaryRow` a way to show a custom formula tooltip, decoupled from the now-removed
`noBrutto` bez-VAT tooltip, so materiały rows explain that VAT is subtracted.

**Contract**:

- Add an optional `hint?: string` field to `SummaryRowOptsT`; when set, render a `HintTooltip` info
  icon (same slot/markup as the `noBrutto` icon) with `hint` as content. `noBrutto` and `hint` are
  independent. Materiały rows pass a hint like „Materiały rozliczane brutto — netto = brutto ÷ (1+VAT),
  VAT odejmujemy (odwrotnie niż przy robociźnie)". (Polish UI string — hint text is user-facing.)

#### 4. Wire vatRate + prop rename in the summary component

**File**: `src/components/kosztorys/kosztorys-summary.tsx`

**Intent**: Pass `vatRate` to the breakdown table and rename the materiały prop.

**Contract**: Rename prop `materialyNet` → `materialsGross` (and its doc comment); pass it to
`computeSummarySplit` and down as needed; pass `vatRate` to `SummaryBreakdownTable`.

#### 5. Prop rename through the chain

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`, `kosztorys-editor-body.tsx`,
`kosztorys-editor-v2.tsx`, `src/lib/kosztorys/types.ts`,
`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`, `src/lib/queries/client-kosztorys.ts`

**Intent**: Unify the materiały amount identifier to `materialsGross` end-to-end so the name matches
its brutto semantics and the `materialsNet`/`materialyNet` split disappears. Values are unchanged — the
source is still `financials.totalMaterialCosts`; only the local names and the panel's
`computeDoZaplatyRM` call are updated.

**Contract**: Mechanical rename `materialsNet` / `materialyNet` → `materialsGross` at each listed site.
Panel: also update the `computeDoZaplatyRM(...)` argument name. Heed the parallel-work caveat above.

#### 6. Unit tests for the economics functions

**File**: `src/__tests__/lib/kosztorys/summary-economics.test.ts`

**Intent**: Lock the VAT-subtraction math and the waterfall consistency.

**Contract**: Add cases: `grossPair(123, 0.23)` → `net ≈ 100`, `gross === 123`; `computeSummarySplit`
with a known materiały gross yields `combined.net = laborNet + gross/(1+vat)` and
`combined.gross = laborGross + gross`; `computeDoZaplatyRM` subtracts wpłaty and adds materiały at the
derived netto (net) and raw gross (gross). Include a `vat = 0` degenerate case (netto === brutto).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Economics unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`

#### Manual Verification:

- Podsumowanie in **Netto** axis: „Materiały", each category row, Łącznie, and Do zapłaty all show
  `brutto/(1+VAT)`; in **Brutto** axis they show the raw amount; the two columns differ by the VAT.
- The formula hint appears on materiały rows and reads correctly (VAT subtracted).
- Robocizna („Suma prac wykonanych") figures are unchanged; udział percentages still sum sensibly.
- Client-share view (`clientView`) renders the same derived figures without owner-only links/screams.

**Implementation Note**: After automated verification passes, pause for manual confirmation of the
Podsumowanie in both axes before archiving.

---

## Testing Strategy

### Unit Tests:

- `grossPair` — VAT removal, `vat=0` degenerate, gross preserved.
- `computeSummarySplit` — combined net/gross with materiały as gross; udział base uses derived net.
- `computeDoZaplatyRM` — wpłaty subtracted, materiały added at derived net (net) / raw (gross).

### Manual Testing Steps:

1. Open an investment kosztorys with materiały transactions; open Podsumowanie.
2. Toggle Netto ↔ Brutto; confirm materiały rows + Łącznie + Do zapłaty derive correctly and differ by VAT.
3. Hover a materiały row; confirm the formula hint.
4. Confirm robocizna figures and the rabat line are unchanged.

## Migration Notes

None — presentation-only, no schema, no data. The Podsumowanie intentionally diverges from the
investment page's materiały figure until the persistence slice.

## References

- Braindump: `context/changes/kosztorys-zaliczka-v2/braindump.md`
- VAT-on-prace-only: `context/reference/kosztorys-editor-domain-notes.md` („VAT dotyczy wyłącznie prac")
- Waterfall math: `src/lib/kosztorys/summary-economics.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Materiały as brutto through the waterfall + formula hint

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`
- [x] 1.3 Economics unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`
