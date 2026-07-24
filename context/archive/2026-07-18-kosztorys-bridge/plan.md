# Kosztorys bridge — Implementation Plan

## Overview

Open the kosztorys↔financial-plane firewall **read-only**: the kosztorys editor gains the
sheet's summary economics — Podsumowanie Robocizna/Materiały/Łącznie split, per-etap „suma
transzy", „suma prac wykonanych", zaliczki per etap, and the footer „aktualnie do zapłaty
R + M" — plus the komentarz column. Live join over the shared Postgres; no sync, no write-back.

## Current State Analysis

- The editor page (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`) loads only the
  kosztorys tree via `getKosztorysTree` (`src/lib/queries/kosztorys.ts:26`) — no investment
  transaction data reaches the editor (FR-015 firewall).
- The financial read side is fully built and reusable: `fetchFilteredByType` /
  `fetchCategoryBreakdowns` (`src/lib/queries/reference-data.ts:190,201`, cached under
  `CACHE_TAGS.transfers`) → `deriveFinancials` (`src/lib/db/investment-financials.ts:34`)
  yields materiały (INVESTMENT_EXPENSE+CORRECTION, unsettled), robocizna (LABOR_COST),
  wpłaty (DEPOSIT_TYPES), settled R+M.
- Client calc: `calc.ts` (pricing, stage-blind) + `settlement.ts` (stage axis). Per-stage row
  value exists (`stageValueForView`, `calc.ts:115`) but **nothing sums the etap axis** across
  rows. Totals surface in `KosztorysTotalsBar` (`kosztorys-editor-body.tsx:99-104`).
- Transfers have **no link to a kosztorys stage** — zaliczki per etap need a new field.
- `note` on kosztorys items is plumbed end-to-end (types, `ITEM_FIELDS` in `v2-rows.ts:19`,
  persistence, queries) but has no grid column.

## Desired End State

Owner opens a kosztorys and sees, below/beside the grid:

1. Podsumowanie block: **Robocizna** (kosztorys wartość netto) / **Materiały** (live sum of
   the investment's unsettled INVESTMENT_EXPENSE+CORRECTION) / **Łącznie**.
2. **Suma transzy per etap** — per-etap column totals at the active view's price base, netto
   - brutto.
3. **R netto / R brutto — suma prac wykonanych** readout.
4. **Zaliczki**: deposit transfers can be tagged with an etap; per-etap zaliczka sums show in
   the etap totals row.
5. Footer „**aktualnie do zapłaty R + M**": (robocizna do zapłaty − Σ zaliczki + materiały),
   netto and brutto.
6. A `komentarz` text column in the grid.

Existing marża / register / investment figures byte-identical; no kosztorys path writes to
the financial plane.

### Key Discoveries

- Mirror the investment detail pattern (`inwestycje/[id]/page.tsx:46-60`): server component
  builds `where`, calls the cached queries, derives, passes plain numbers as props.
- New reads must be tagged `CACHE_TAGS.transfers` — transfer mutations revalidate that tag,
  keeping the join live with zero new machinery.
- Robocizna figures come from the client-side editor calc (they react to unsaved edits);
  materiały/zaliczki come as server props. Mixing is correct: materiały can't change inside
  the editor session.
- „Pozostało/bilans" formula is **provisional** (owner still deciding) — don't lock it with
  tests or build dependents on it.

## What We're NOT Doing

- No write-back: no auto-`LABOR_COST`, no rabat unification, no mutation of transfers/
  registers/marża from kosztorys code. FR-015 write firewall stays.
- No sync machinery; no v1 mechanism (Synchronizuj / mirror tabs / iframe) rebuilt.
- **Oferta view + PDF eksport** — moved to the import/export slice (owner, 2026-07-18).
- **Pie „% udziału"** — filed EX-529 (nice-to-have).
- No udział-% base change (section panel keeps executed base).
- No Brutto column relocation (open owner-decision).
- No client-facing delivery mechanism (file / app→arkusz script — later stage).

## Implementation Approach

Five phases in dependency order; each ships and is dogfooded independently. Server-side:
one small aggregation added to the editor page mirroring the investment-detail read pattern.
Client-side: extend the existing calc/settlement pure layers + `KosztorysTotalsBar` /
section-summary components. The only schema change is the zaliczka etap tag (Phase 4).

## Critical Implementation Details

- **Deposit↔etap tag semantics**: tagging a deposit with an etap _is_ the declaration "this
  wpłata is a zaliczka against that etap". Untagged deposits are not netted per etap. The
  field is optional and only meaningful for `DEPOSIT_TYPES`.
- **Migrations are hand-written** (see AGENTS.md — `migrate:create` emits phantom drift).
  Kosztorys data is throwaway pre-dogfooding-merge, but **transfers are real prod data** —
  the new column must be nullable with no backfill.
- Brutto everywhere = `toGross(net, vatRate)` (`calc.ts:63`) with the investment's VAT.

## Phase 1: Podsumowanie Robocizna / Materiały / Łącznie

### Overview

First firewall opening: materiały total flows into the editor read-only; the split block
renders with udział % per the sheet (Podsumowanie r06–08).

### Changes Required:

#### 1. Server read on the editor page

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Fetch the investment's financials alongside the tree and pass a small
`materialsNet` (unsettled materiały total) prop into the editor.

**Contract**: `Promise.all` with `fetchFilteredByType(where)` (+ breakdowns if needed) →
`deriveFinancials(...)` → pass `totalMaterialCosts`. Cached path already tagged
`CACHE_TAGS.transfers`.

#### 2. Podsumowanie block

**File**: `src/components/kosztorys/kosztorys-totals-bar.tsx` (or a sibling block in
`kosztorys-editor-body.tsx`)

**Intent**: Render Robocizna (client-side `doZaplatyNet` from the editor hook) / Materiały
(server prop) / Łącznie (sum), each netto+brutto and with udział % of Łącznie.

**Contract**: props threaded through `KosztorysEditorV2` → `kosztorys-editor-body.tsx`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit test: Podsumowanie split math (Robocizna + Materiały = Łącznie, udział %) —
  `pnpm exec vitest run` on the new spec

#### Manual Verification:

- Editor shows the split; adding an INVESTMENT_EXPENSE transfer for the investment updates
  Materiały on next load (no manual refresh machinery)
- Marża / investment detail figures unchanged

---

## Phase 2: Etap axis — suma transzy + suma prac wykonanych

### Overview

Sum the etap axis across all rows (the sheet's `SUM(col5:394)` per etap column) at the
active view's price base; surface the „R netto / R brutto — suma prac wykonanych" pair.

### Changes Required:

#### 1. Etap-axis aggregation

**File**: `src/lib/kosztorys/settlement.ts`

**Intent**: New pure function summing `stageValueForView` per stage across rows →
`Map<stageId, net>`; view-priced (follows the active client/subcontractor view).

**Contract**: `stageTotalsForView(rows, stages, view): Map<number, number>` — Phase 5
depends on this signature.

#### 2. Render etap totals + wykonane readout

**File**: `src/components/kosztorys/kosztorys-totals-bar.tsx` (+ editor hook export)

**Intent**: Per-etap totals row (netto + brutto) and the suma-prac-wykonanych pair
(Σ `rowValueForView` — already the basis of section subtotals; total exists as executed sum).

**Contract**: read-only display; respects the `moneyAxis`/view toggles already in the bar.

### Success Criteria:

#### Automated Verification:

- Unit tests: `stageTotalsForView` (rabat 'amount' reconciliation — Σ etap totals across
  stages equals Σ row executed values; empty stages) — `pnpm exec vitest run`
- `pnpm typecheck` and `pnpm lint` pass

#### Manual Verification:

- Etap totals match the filled test sheet's r396/r397 for seeded data (`INV=6 seed`)
- Toggling client/subcontractor view changes the totals consistently with the grid

---

## Phase 3: Komentarz column

### Overview

Expose the already-plumbed `note` field as a grid text column (sheet col `T` = komentarz).

### Changes Required:

#### 1. Column registration

**Files**: `src/lib/kosztorys/column-config.ts`, `src/components/kosztorys/kosztorys-v2-columns.tsx`

**Intent**: Add `note` to `COLUMN_LABELS` („Komentarz") + `COLUMN_LAYER`, and a
`keyCol('note', textColumn, …)` in `assembleV2Columns`. No data plumbing — the field is
already diffed and persisted.

**Contract**: appears in the column picker; editable; round-trips through save.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` and `pnpm lint` pass
- Existing kosztorys row/diff unit tests still green: `pnpm exec vitest run`

#### Manual Verification:

- Type a komentarz, save, reload — persists; column togglable in the picker

---

## Phase 4: Zaliczki — etap tag on deposits

### Overview

Model zaliczki as etap-tagged deposit transfers: optional relationship on transfers to a
kosztorys stage. One source of truth, no double entry.

### Changes Required:

#### 1. Schema + migration

**Files**: `src/collections/transfers.ts`, `src/migrations/` (hand-written)

**Intent**: Optional `kosztorysStage` relationship (→ kosztorys-stages), admin-visible only
for deposit types. Nullable column, no backfill (transfers are real prod data).

**Contract**: nullable FK; existing rows untouched; migration follows the latest file's
structure per AGENTS.md.

#### 2. Tagging UI

**File**: deposit form under `src/components/forms/` (transfer/deposit dialog)

**Intent**: Optional „Zaliczka na etap" select on deposit creation/edit, listing the target
investment's kosztorys stages.

**Contract**: server action validation: tag allowed only on `DEPOSIT_TYPES`; stage must
belong to the investment's kosztorys.

#### 3. Per-etap zaliczka sums into the editor

**Files**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`, totals bar

**Intent**: Server read summing tagged deposits per stage (`Map<stageId, amount>`), passed
as a prop; shown as a „zaliczki" row under the etap totals.

**Contract**: query cached under `CACHE_TAGS.transfers`; several deposits per etap sum.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local DB: `pnpm payload migrate`
- Unit test: per-etap zaliczka aggregation (several per etap; untagged deposits excluded)
- Action validation test: tag rejected on non-deposit types
- `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` pass

#### Manual Verification:

- Tag two deposits to one etap → editor shows their sum under that etap
- Untagged deposits don't appear; marża/bilans figures unchanged

---

## Phase 5: Footer „aktualnie do zapłaty R + M"

### Overview

The headline figure (sheet r456–464 / filled r400): robocizna do zapłaty − Σ zaliczki +
materiały, netto and brutto.

### Changes Required:

#### 1. Compose the figure

**File**: `src/components/kosztorys/kosztorys-totals-bar.tsx` (+ editor hook)

**Intent**: `doZaplatyRM = (robocizna do zapłaty netto) − Σ(zaliczki) + materialsNet`,
rendered netto + brutto in the footer. Spec the _intent_, not the sheet's exact ranges (the
test sheet's `SUM(U398:AD403)` double-counts — known broken).

**Contract**: pure client composition of Phase 1/2/4 inputs; no new queries.

### Success Criteria:

#### Automated Verification:

- Unit test: composition math incl. zero-zaliczki and zaliczki-exceed-robocizna cases
- `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` pass

#### Manual Verification:

- Figure cross-checks against the canonical sheet's footer for equivalent data
- Owner sign-off on the netting semantics (zaliczki reduce R before adding M)

---

## Testing Strategy

### Unit Tests:

- `stageTotalsForView` — rabat reconciliation, empty stages, view switching
- Podsumowanie split + R+M composition math
- Zaliczka aggregation + action validation

### Integration Tests:

- None new; existing DB specs stay green (`pnpm test:integration` runs pre-push).

### Manual Testing Steps:

1. Seed `INV=6` (`seed-kosztorys.ts`), cross-check etap totals vs the filled test sheet.
2. Add/cancel an INVESTMENT_EXPENSE and a tagged deposit; verify editor figures follow.
3. Verify investment detail + listing marża/bilans unchanged throughout.

Browser-level slice ⇒ owes an E2E at the review gate (author or file `e2e-backlog`).
**Do not** write tests asserting the „pozostało/bilans" formula — provisional.

## Performance Considerations

New server reads are two cached queries (already used by the investment page) — no impact
on the 1000+-row grid path; etap totals are O(rows×stages), same order as existing
section subtotals.

## Migration Notes

One hand-written migration (Phase 4): nullable `kosztorys_stage_id` on transactions.
Prod migration applied by a human via `pnpm db:migrate:prod` before the code ships —
deploy-time gate, not a phase gate.

## References

- `context/changes/kosztorys-bridge/change.md`, `braindump.md`
- Gap table: `context/changes/kosztorys-parity-gaps/braindump.md`
- Domain: `context/reference/kosztorys-editor-domain-notes.md` (P5 firewall L353–375)
- Read pattern: `src/app/(frontend)/inwestycje/[id]/page.tsx:46-60`
- Out of scope homes: oferta view + PDF → import/export slice; pie → EX-529

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Podsumowanie Robocizna / Materiały / Łącznie

#### Automated

- [x] 1.1 Type check passes: `pnpm typecheck` — 3d445a6a
- [x] 1.2 Lint passes: `pnpm lint` — 3d445a6a
- [x] 1.3 Unit test: Podsumowanie split math — 3d445a6a

### Phase 2: Etap axis — suma transzy + suma prac wykonanych

#### Automated

- [x] 2.1 Unit tests: `stageTotalsForView` — aa2146f7
- [x] 2.2 `pnpm typecheck` and `pnpm lint` pass — aa2146f7

### Phase 3: Komentarz column

#### Automated

- [x] 3.1 `pnpm typecheck` and `pnpm lint` pass — 48847a6f
- [x] 3.2 Existing kosztorys row/diff unit tests green — 48847a6f

### Phase 4: Zaliczki — etap tag on deposits

#### Automated

- [x] 4.1 Migration applies cleanly: `pnpm payload migrate` — 47849ff2
- [x] 4.2 Unit test: per-etap zaliczka aggregation — 47849ff2
- [x] 4.3 Action validation test: tag rejected on non-deposit types — 47849ff2
- [x] 4.4 `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` pass — 47849ff2

### Phase 5: Footer „aktualnie do zapłaty R + M"

#### Automated

- [x] 5.1 Unit test: composition math (zero-zaliczki, zaliczki > robocizna) — aeb27fd4
- [x] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` pass — aeb27fd4
