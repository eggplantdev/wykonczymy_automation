# Investments listing shows real v2 figures without a kosztorys — Implementation Plan

## Overview

The Inwestycje listing prints „brak danych" on Bilans netto v2, Bilans brutto v2, Robocizna v2,
Marża v2 and „Pozostało do wypłaty" for every investment without a kosztorys. Owner ruling 2026-10-02:
an investment without a kosztorys (e.g. „Kijowska 17 dwa mieszkania", settled on materials only) is
legitimate, so the four figure columns print their real values. „Pozostało do wypłaty" still withholds
there, but now says „brak kosztorysu" instead of „brak danych".

The same pass fixes a second source of confusion (owner, 2026-10-02). Each investment shows only one
of its two bilans columns. The other one says „nie dotyczy" today; it will say why instead, by naming
the tryb: „rozliczenie brutto" in Bilans netto v2, and „rozliczenie netto" / „rozliczenie mieszane" in
Bilans brutto v2.

## Current State Analysis

- The gate is **display-only** and lives in `src/components/tables/investments.tsx`
  (`hasKosztorysReading`, `NoKosztorysData`). Every figure behind it is already computed for a
  no-kosztorys row: robocizna 0, bilans, marża v2 (`margin-v2.ts:32` is null only on an unconfirmed
  plane).
- The one row field that withholds by presence is `subcontractorRemaining`
  (`shape-investments.ts:103-106`). It **stays** as it is, because the owner kept the withhold.
- `worker-payout-pairs.ts:32` (SQL `EXISTS kosztorys_items`) stays as it is. The Σ-pairs invariant,
  `/pracownicy` and „Rozlicz wypłaty" are therefore untouched.
- The investment page's Podsumowanie never withholds. After this change the listing agrees with it.
- `hasKosztorys` stays on the row. `trash-investment-button.tsx:28` reads it, and so will the
  „Pozostało" cell.
- No component spec covers `investments.tsx`, which is how the defect shipped.

Detail, prod data and history: `research.md`.

## Desired End State

On `/inwestycje`, an investment without a kosztorys shows:

- Bilans netto v2 or brutto v2 (whichever the tryb builds): the real bilans. The other column names
  the tryb („rozliczenie brutto" / „rozliczenie netto" / „rozliczenie mieszane") instead of
  „nie dotyczy". This applies to every row, with or without a kosztorys.
- Robocizna v2: 0,00 zł, with the rozjazd icon wherever Robocizna v1 is non-zero.
- Marża v2: the real figure.
- „Pozostało do wypłaty": „brak kosztorysu". The row still sorts last, and the cell is not a link.

„nie dotyczy" no longer appears on the listing either.
A kosztorys with no executed etapy still reads −wypłaty in „Pozostało". An etap without a rozliczenie
still reads „ustaw etapy". The string „brak danych" no longer appears anywhere on the listing.

### Key Discoveries:

- `investments.tsx:86-89` — `balanceOrUndefined` also feeds the **sort**. Removing the gate there
  makes no-kosztorys rows sort by their bilans instead of last. That is intended. Lessons.md:1596(3)
  says to watch the sort, not just the cell.
- `investments.tsx:204` — the gate also suppressed the Robocizna v2 rozjazd icon. Restoring it is how
  the 11 active legacy investments (robocizna booked only as transfers) get flagged.
- `users.tsx:47` already uses `text-muted-foreground` for a withheld „Pozostało" cell. The new
  „brak kosztorysu" uses the same muted `text-xs` span as „ustaw etapy" and „nie dotyczy".
- `settlement-mode.ts` — `settlementModeLabel` gives „Netto" / „Brutto" / „Mieszane". „Mieszane"
  settles on netto (`MONEY_AXIS_BY_MODE`), so only Bilans netto v2 can name „brutto", while Bilans
  brutto v2 can name either of the other two. Build the text from that label, so a new tryb arrives
  with its own wording.
- Lessons.md:1596(2): a rule stated in a comment, a test and a checklist must be reversed in all
  three.

## What We're NOT Doing

- No change to `subcontractorRemaining`, `shape-investments.ts` or `worker-payout-pairs.ts`. The
  presence gate on „Pozostało" stays.
- No hint for „kosztorys bez wykonanych etapów". −wypłaty stays (decision 3).
- No backfill of legacy robocizna into kosztorysy, and no change to v1 columns or the panel.
- No change to the tryb rule itself (which bilans exists). Only its wording changes.
- No change to the other „nie dotyczy" uses (`coeff-cell.tsx`, `deposit-planes.ts`). They mean
  something else.
- No Linear issue. This is single-session work, and the change folder is its record.

## Implementation Approach

Test-driven debugging, as AGENTS.md requires for a shipped bug:

1. Write a DOM spec that renders the listing with a no-kosztorys row and asserts the real figures.
   It must fail on „brak danych".
2. Strip the gate from the four figure columns and reword the „Pozostało" cell.
3. Reverse the rule wherever it is still stated: tooltips, JSDoc, AGENTS.md, the foundation doc, the
   manual-checks entry and spec comments.

## Phase 1: Failing spec, then the cells

### Overview

Reproduce the bug at the DOM layer, then:

- remove the gate from Bilans netto/brutto v2, Robocizna v2 and Marża v2;
- change „Pozostało" to say „brak kosztorysu";
- replace „nie dotyczy" with the tryb's name.

### Changes Required:

#### 1. DOM regression spec

**File**: `src/__tests__/components/tables/investments.test.tsx` (new; mirrors
`src/components/tables/investments.tsx`)

**Intent**: Guard the listing's render of a no-kosztorys row, a layer that has no spec today. Write it
first and watch it fail on „brak danych" before touching the source.

**Contract**:

- Render through `InvestmentDataTable` with an OWNER role, so Marża v2 is present. Mocking follows
  `users.test.tsx`: `next/navigation`, plus whatever supplies `useCurrentUser`. Server actions are
  already stubbed by the harness.
- Build a row factory over `InvestmentRowT` and locate cells by column-header index, as
  `users.test.tsx` does.
- Cases:
  - A NET row without a kosztorys, no v1 robocizna (the Kijowska shape) prints:
    - Bilans netto v2: its `balance`
    - Bilans brutto v2: „rozliczenie netto"
    - Robocizna v2: 0,00 zł with no rozjazd icon
    - Marża v2: its `marginV2`
    - „Pozostało do wypłaty": „brak kosztorysu"

    The page contains no „brak danych".

  - A GROSS row prints „rozliczenie brutto" in Bilans netto v2. A MIXED row prints „rozliczenie
    mieszane" in Bilans brutto v2. The page contains no „nie dotyczy".
  - A no-kosztorys row **with** v1 robocizna shows the Robocizna v2 rozjazd icon. Query it by the
    `mismatch` variant's aria-label.
  - A row with a kosztorys and no executed work (`hasKosztorys: true`, `subcontractorRemaining`
    = −wypłaty) prints the negative kwota in „Pozostało".
  - Sorting Bilans netto v2 places a no-kosztorys row by its value, not last. Sorting „Pozostało" still
    places the „brak kosztorysu" row last.

#### 2. Listing cells

**File**: `src/components/tables/investments.tsx`

**Intent**: Bilans netto/brutto v2, Robocizna v2 and Marża v2 stop consulting kosztorys presence.
„Pozostało do wypłaty" becomes the only column that withholds on it, and its cell says
„brak kosztorysu".

**Contract**:

- `balanceOrUndefined` returns the figure whenever the tryb builds that plane. Only the other tryb's
  cell is undefined, and it still sorts last.
- `NotApplicable` becomes a cell that names the row's tryb:
  `rozliczenie ${settlementModeLabel(mode).toLowerCase()}`, in the same muted `text-xs` span. Rename
  it to match. Update its comment (:70-74) only where it names „nie dotyczy".
- The Bilans netto v2 and brutto v2 cells drop their `NoKosztorysData` branch.
- The Robocizna v2 cell drops its early return, so the rozjazd icon renders for every row.
- `withheldFigureCell` keeps only the `undefined` → „ustaw etapy" rule.
- „Pozostało" cell order: no kosztorys → „brak kosztorysu"; `undefined` → „ustaw etapy"; otherwise
  the link.
- Replace `NoKosztorysData` with a component that prints „brak kosztorysu" in the same muted `text-xs`
  span. `hasKosztorysReading` (a one-line wrapper) goes; read `row.hasKosztorys` directly.
- Rewrite the comment at :41-49 so it explains why **only** „Pozostało" withholds without a
  kosztorys: there it would merely reprint wypłaty with a minus and sort legacy investments among
  real overpayments. Keep the `hasKosztorys`-not-`totalLaborCosts` paragraph. It still explains why a
  zero-progress kosztorys reads −wypłaty and not „brak kosztorysu".
- Update the comment at :83-85 so it no longer implies no-kosztorys rows are withheld, and so it
  names the tryb cell instead of „nie dotyczy".

### Success Criteria:

#### Automated Verification:

- The new spec fails on the unchanged source: `pnpm exec vitest run src/__tests__/components/tables/investments.test.tsx`
- The new spec passes after the cell change: same command

#### Manual Verification:

- On `/inwestycje`, a NET investment prints „rozliczenie netto" in Bilans brutto v2. „11 Listopada 40"
  (GROSS) prints „rozliczenie brutto" in Bilans netto v2. No cell reads „nie dotyczy".
- On `/inwestycje` as OWNER, „Kijowska 17 dwa mieszkania materiały" shows:
  - Bilans netto v2 = −Wydatki inwestycyjne (−18 661,21 zł on today's data)
  - Robocizna v2 = 0,00 zł
  - a real Marża v2
  - „brak kosztorysu" under „Pozostało do wypłaty"
- A legacy investment with robocizna booked as transfers (e.g. Altowa 12) shows Robocizna v2
  0,00 zł with the rozjazd icon, whose tooltip quotes the gap.
- Sorting Bilans netto v2 both ways interleaves no-kosztorys rows by value. Sorting „Pozostało do
  wypłaty" both ways keeps „brak kosztorysu" and „ustaw etapy" rows last.
- No cell on the listing reads „brak danych".

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do
not pause for per-phase manual confirmation.

---

## Phase 2: Reverse the rule wherever it is stated

### Overview

Every place that still says „no kosztorys → brak danych" now says what the listing actually does.

### Changes Required:

#### 1. Header tooltips

**File**: `src/components/tables/investments-header-tips.ts`

**Intent**: Header tooltips describe the new behaviour.

**Contract**:

- `FROM_KOSZTORYS` says that without a kosztorys robocizna and rabat are 0 zł. It feeds `balance`,
  `balanceGross` and `marginV2`.
- `laborCostsFromKosztorys` says 0 zł rather than a transfers reading, and says the icon shows the
  rozjazd from v1.
- `subcontractorRemaining` says „brak kosztorysu", and why: the kwota would only be wypłaty with a
  minus.
- `balance` (:15) stops quoting „nie dotyczy" and says what the cell prints instead.
  `balanceGross` gets the same treatment if its wording needs it.
- Polish, in the same register as the existing tips.

#### 2. Row-type JSDoc

**File**: `src/types/table-rows.ts`

**Intent**: Stop claiming the v2 columns withhold on `hasKosztorys`.

**Contract**:

- The `hasKosztorys` doc names its two readers: the „Pozostało" cell and the trash button.
- The `subcontractorRemaining` doc stays accurate. Touch it only if wording references „brak danych".

#### 3. Code and spec comments

**Files**: `src/lib/queries/shape-investments.ts:89`, `src/__tests__/lib/queries/shape-investments.test.ts`

**Intent (shape-investments.ts)**: The comment on `balanceGross` says the listing prints
„nie dotyczy". Reword it to the tryb cell.

**Contract**: Comment only.

**File**: `src/__tests__/lib/queries/shape-investments.test.ts`

**Intent**: The comment above „tells an absent kosztorys from one that sums to zero" (:421-424) says
the listing prints „brak danych" and suppresses the rozjazd icon. Reword it to the remaining stake:
„Pozostało" would print „brak kosztorysu" over a complete rozpiska.

**Contract**: Comment only. Assertions unchanged.

#### 4. Durable docs

**Files**: `AGENTS.md`, `context/foundation/investment-financials-and-discount.md`,
`context/foundation/manual-checks.md`

**Intent**: Reverse the rule in the living docs, per lessons.md:1596(2).

**Contract**:

- `AGENTS.md:390`: replace the sentence „The listing RENDERS that zero as „brak danych" on its v2
  columns…" with the new rule:
  - The listing prints that zero.
  - An investment settled on materials alone is legitimate (owner, 2026-10-02).
  - Only „Pozostało do wypłaty" withholds, as „brak kosztorysu".
  - The Robocizna v2 rozjazd icon is what flags legacy robocizna not yet in a kosztorys.

  Keep the rest of the paragraph.

- `investment-financials-and-discount.md:177-180`: the bullet becomes „No kosztorys → „brak
  kosztorysu", not `−wypłaty`". Its rationale stays. Add that the other v2 columns print real figures
  without a kosztorys.
- `manual-checks.md:2071-2073`: leave the ticked historical entry. Append an italic note that
  2026-10-02 (`investments-listing-no-kosztorys-figures`) changed the wording to „brak kosztorysu".

### Success Criteria:

#### Automated Verification:

- Neither „brak danych" nor „nie dotyczy" remains in the listing's sources:
  `grep -n "brak danych\|nie dotyczy" src/components/tables/investments.tsx src/components/tables/investments-header-tips.ts src/types/table-rows.ts src/lib/queries/shape-investments.ts`
  returns nothing.
- The touched spec still passes: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`

#### Manual Verification:

- Hovering the headers of Bilans netto v2, Robocizna v2, Marża v2 and „Pozostało do wypłaty" shows
  tooltips matching the cells. None mentions „brak danych".

---

## Testing Strategy

### Unit Tests:

- None new. `shape-investments.test.ts` and `investment-render-parity-db.test.ts` stay valid as they
  are, because the „Pozostało" row field still withholds without a kosztorys.

### Component (DOM) Tests:

- `src/__tests__/components/tables/investments.test.tsx`: the regression guard from Phase 1. It
  covers the cells, the rozjazd icon and the two sorts.
- Test disposition: test-driven debugging · DOM. The risk is render-only (client cell logic), so
  Playwright would pay for client → server → DB boundaries the bug never crosses.

### Manual Testing Steps:

1. `/inwestycje` as OWNER, filter Aktywne. Check the Kijowska row column by column against the
   Phase 1 manual bullets. Check one NET and one GROSS row's tryb cell.
2. Sort Bilans netto v2 and „Pozostało do wypłaty" in both directions.
3. Hover the four v2 headers.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

The full suite is not run unasked (owner preference). The pre-push hook runs it on push.

## References

- Research and decisions: `context/changes/2026-10-02-investments-listing-no-kosztorys-figures/research.md`
- DOM spec pattern: `src/__tests__/components/tables/users.test.tsx`
- Lesson on reversing a display rule: `context/foundation/lessons.md:1596`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Failing spec, then the cells

#### Automated

- [x] 1.1 New spec fails on the unchanged source — 93faea01
- [x] 1.2 New spec passes after the cell change — 93faea01

### Phase 2: Reverse the rule wherever it is stated

#### Automated

- [x] 2.1 No „brak danych" / „nie dotyczy" left in the listing's sources — 99419432
- [x] 2.2 shape-investments spec still passes — 99419432
