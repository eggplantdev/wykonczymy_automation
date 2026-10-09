# „% wykonania (względem przedmiaru ofertowego)” column — Implementation Plan

## Overview

EX-921 split the Przedmiar into „Przedmiar ofertowy” and „Aktualizacja przedmiaru”, and moved
„% wykonania” and „Pozostało” to the aktualizacja. The owner still wants to see how much of the
**offer** is done. This plan adds a second percentage column computed against the ofertowy. The
existing column stays as it is.

## Current State Analysis

- `% wykonania` is the computed column `donePercent`:
  - It is `rowDoneFraction(row, clientQtyDone(row))` (`src/lib/kosztorys/columns/column-values.ts:68`).
  - `rowDoneFraction` divides by `resolvedCurrentPlannedQty(row)`, which is `currentPlannedQty ?? plannedQty`
    (`src/lib/kosztorys/calc.ts:247,347`).
  - It returns `null` when the divisor is not `> 0`.
- `columnValueResolver` is the single source for:
  - the cell,
  - the sort (`kosztorys-sort-value`),
  - the totals (`column-totals.ts`), which give a ratio no total, so the cell renders blank,
  - the print.
    A new id registered there reaches all of them.
- Where `donePercent` is wired, by surface:
  - Editor grid: `kosztorys-v2-columns.tsx:337`. It has a `danger` tone from `hasStagesOverPlanned` and
    sits between the per-etap wartości and Pozostało.
  - Column config: label `column-config.ts:51`, layer `progress` (`:180`). It is deliberately untagged
    in `COLUMN_MONEY_AXIS`.
  - Header tip: `header-tips.ts:41`.
  - Settlement hiding: `SETTLEMENT_TOTAL_COLUMNS` (`settlement-columns.ts:7`). The column stays off
    every document until an etap has an entry.
  - Investor document: `CLIENT_VIEW_GROUPS` „Etapy i postęp” and `CLIENT_DOCUMENT_COLUMNS`
    (`client-view/columns.ts`), `DEFAULT_VISIBLE_COLUMNS` (`client-view/settings.ts:37`), and the
    print (`print/offer-columns.ts:80`).
- The worker document currently leaves out the ofertowy **by construction** (`worker-view/columns.ts`
  header comment: „the crew works to the current scope”). That is reversed here: the managers decide
  (2026-10-09). Facts that shape the reversal:
  - Worker settings are one firm-wide row in `kosztorys_worker_view_settings`. The stored value is the
    **hidden** set and the default hides nothing (`WORKER_VIEW_DEFAULT_SETTINGS`). A new ceiling key
    therefore shows on every worker document unless the default and the stored row both hide it.
  - `LEGACY_KEYS` maps a stored `plannedQty` to `currentPlannedQty` (`worker-view/settings.ts`), a
    pre-EX-921 rename. Once `plannedQty` is a live worker key, that mapping would read an owner's untick
    of the ofertowy as an untick of the aktualizacja. The mapping has to go. The prod row (dump
    2026-10-09 07:36) holds `hidden_columns = ["remainingForPlane"]`, `column_ranks = {}`, so it
    carries no legacy key to lose.
  - The worker surface computes from his etapy only (`scope.stages`) and passes `executedQtyByItem`
    = Σ over every etap (`worker-kosztorys.ts:77`). `remainingForPlane` reads that all-etapy figure,
    because how much of a pozycja is done is a fact about the pozycja, not about one crew.
  - Worker labels and tips are translated (pl / uk / ru). `plannedQty` already has a label and
    `tipPlannedQty` in all three, so only the new percentage needs entries.
  - The worker print builds its own `byKey` (`print/worker-columns.ts`). A key missing there is
    silently dropped from the PDF.
- Editor hiding: an absent key in the stored map means „ask `DEFAULT_HIDDEN_COLUMNS`”
  (`use-hidden-columns.ts:29`). A new column that is not in that set therefore shows in the editor
  with no migration.
- Investor-view hiding: the stored value is the **hidden** set (`sanitizeClientViewSettings`). Without
  a migration, a new allowlisted key would be **visible** on every investor link with saved settings.
  `20261008_1_client_view_note_hidden.ts` is the precedent for appending a key to every stored set.
- A pozycja added from a worker report has a Przedmiar ofertowy of 0 and an aktualizacja equal to the
  reported quantity (EX-921 notes).

## Desired End State

The editor shows a „% wykonania (względem przedmiaru ofertowego)” column right after the existing
„% wykonania (względem aktualizacji przedmiaru)”. Each row reads Pomiar / Przedmiar ofertowy:

- It is blank where the ofertowy is 0, which covers every pozycja added from a worker report.
- It reads above 100% where the work grew past the offer.

Like its neighbour, it:

- belongs to the „Postęp” reading mode,
- sorts,
- has no total,
- stays off the investor's document until the first etap entry.

On the investor document it is an available tick in „Etapy i postęp”, unticked everywhere, including
on every investment whose settings are already saved.

The worker-document settings („Widok pracownika”) offer two new ticks, both unticked:

- „Przedmiar ofertowy”, in „Opis i ilości”;
- the new percentage, in „Etapy i postęp”.

The manager decides per firm. The worker's percentage is the same figure as the editor's: the pozycja's
pomiar over all etapy, divided by the ofertowy. It is not just his own etapy.

### Key Discoveries:

- The whole computation is one `byField` entry. Every other surface either reads `columnValueResolver`
  or lists the id.
- **Two percentages, one tint.** The red tint on the existing column means „past the agreed scope”
  (the aktualizacja). Past the _offer_ is normal once the aktualizacja grew, so tinting the new column
  red would flag agreed work as an error. The new column stays `muted` and unemphasized; the >100%
  figure carries the information.
- The id follows the przedmiar pair's naming (`plannedNet` / `currentPlannedNet`): `plannedDonePercent`.
  The existing `donePercent` keeps its id. Renaming it would mean rewriting every stored hidden set
  and its migration history (`20260928_2_client_view_single_set.ts` names it) for no reader-visible gain.

## What We're NOT Doing

- No change to the existing „% wykonania”, to „Pozostało”, or to any of their labels.
- No worker tick for the existing „% wykonania” or for „Wartość netto przedmiaru ofertowego”. Only the
  two named items become worker ticks.
- No change to the worker's „Ukryj aktualizację przedmiaru i jej wartość, gdy w etapach są już wpisy”
  switch. It keeps covering the aktualizacja only, and the ofertowy answers to its own tick.
- No total, neither in „Razem” nor in the section footers. A ratio has no honest sum, the same as its neighbour.
- No default tick on the investor document. The owner opens it per investment.
- No change to Prognoza marży, which already reads the ofertowy.

## Implementation Approach

Three phases:

1. Register the figure and show it in the editor.
2. Make it an investor-document tick, with the data migration that keeps it hidden on existing views.
3. Make it and the Przedmiar ofertowy worker-document ticks, retiring the legacy key mapping.

Phases 2 and 3 each depend only on Phase 1, so either can ship separately.

## Phase 1: The figure and the editor column

### Overview

Compute `plannedDonePercent` and render it in the grid beside `donePercent`.

### Changes Required:

#### 1. Fraction against the ofertowy

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Add a sibling to `rowDoneFraction` that divides by `row.plannedQty`, with the same `> 0`
guard. The guard covers `null`, `undefined`, 0 and negative values, as the existing doc comment explains.
Both functions share the guarded division through one private helper, so the guard has one home.

**Contract**: `export function rowOfferDoneFraction(row: Pick<KosztorysItemT, 'plannedQty'>, totalQtyDone: number): number | null`.
`rowDoneFraction` keeps its signature and behaviour.

#### 2. Resolver entry

**File**: `src/lib/kosztorys/columns/column-values.ts`

**Intent**: Register `['plannedDonePercent', (row) => rowOfferDoneFraction(row, clientQtyDone(row))]`
next to `donePercent`. It uses the same client-plane pomiar as its neighbour, so the two differ only
by their divisor.

**Contract**: `columnValueResolver(...)('plannedDonePercent')` returns a `ColumnValueT`.

#### 3. Column config + tip

**Files**: `src/lib/kosztorys/columns/column-config.ts`, `src/lib/kosztorys/header-tips.ts`

**Intent**:

- Label: `'% wykonania (względem przedmiaru ofertowego)'`.
- Layer: `COLUMN_LAYER.plannedDonePercent = 'progress'`.
- Money axis: untagged, the same as `donePercent`. Extend the existing comment at `:152` to name both ids.
- Tip, mirroring the `donePercent` tip: „Procent wykonania względem przedmiaru ofertowego. Ile procent
  oferty jest zrobione. Powyżej 100% — wykonano więcej, niż zakładała oferta (np. po aktualizacji
  przedmiaru). Puste dla pozycji spoza oferty.” plus `CLIENT_BASE`.

**Contract**: `COLUMN_LABELS.plannedDonePercent`, `COLUMN_LAYER.plannedDonePercent`, `HEADER_TIPS.plannedDonePercent`.

#### 4. Grid column

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Add `resolvedColumn('plannedDonePercent', { tone: () => 'muted' }, formatPercent)` to the
`donePercent` array, after the existing entry. That places it between „% wykonania” and „Pozostało”.
No `danger` tone; see Key Discoveries. Not added to `DEFAULT_HIDDEN_COLUMNS`.

**Contract**: The grid column id is `plannedDonePercent`.

#### 5. Settlement hiding

**File**: `src/lib/kosztorys/settlement-columns.ts`

**Intent**: Add `plannedDonePercent` to `SETTLEMENT_TOTAL_COLUMNS`. Before any etap entry, it reads
0% on every row, the same as its neighbour.

#### 6. Specs

**Files**:

- `src/__tests__/lib/kosztorys/columns/column-values.test.ts`
- `src/__tests__/lib/kosztorys/settlement-columns.test.ts`
- `src/__tests__/components/kosztorys/editor/grid/kosztorys-layer.test.ts`
- any spec that pins the full grid id list (`v2-columns-readonly`, `workshop-columns`,
  `column-value-parity`); grep `donePercent` under `src/__tests__/components/kosztorys/editor/grid`.

**Intent**:

- Risk: the two percentages diverge by the wrong divisor. Use a row whose aktualizacja differs from
  its ofertowy, assert both values, and confirm the new one divides by the ofertowy.
- A row with ofertowy 0 and a pomiar (a worker-report extra) returns `null`, not `Infinity`.
- `emptySettlementColumnIds` hides it before the first entry.
- The layer is `progress`.
- Full-id-list specs get the new id at its position.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/columns/column-values.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-columns.test.ts`
- The touched grid specs under `src/__tests__/components/kosztorys/editor/grid/` pass.

#### Manual Verification:

- Kosztorys editor, an investment with an etap entered and a pozycja whose Aktualizacja przedmiaru
  differs from its Przedmiar ofertowy: both „% wykonania” columns appear side by side and differ by
  exactly that ratio. The new one is not tinted red above 100%.
- A pozycja added from a worker's zgłoszenie (Przedmiar ofertowy 0) shows a blank new column, not
  „∞” or „NaN”.
- Switching „Praca” / „Postęp” hides and shows the new column together with the old one. Sorting by it
  orders rows by the percentage. „Razem” and the section footers are blank under it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Investor-document tick

### Overview

Allow the column on the investor's document (podgląd, link, „Generuj ofertę”), unticked everywhere.

### Changes Required:

#### 1. Allowlist and order

**File**: `src/lib/kosztorys/client-view/columns.ts`

**Intent**:

- Add `plannedDonePercent` to the „Etapy i postęp” group, after `donePercent`.
- Add it to `CLIENT_DOCUMENT_COLUMNS` after `donePercent`.
- Do not add it to `DEFAULT_VISIBLE_COLUMNS` (`settings.ts`). It is an available tick, like Pozostało.

#### 2. Print column

**File**: `src/lib/kosztorys/print/offer-columns.ts`

**Intent**: Add a `plannedDonePercent` entry built the same way as `donePercent`: `qtyColumn` +
`formatPercent` over `valueOf('plannedDonePercent')`, labelled `clientLabel('plannedDonePercent')`.
Without it, a ticked column would show on the podgląd and silently drop from the PDF
(`byKey[key] ?? []`).

#### 3. Data migration

**Files**: `src/migrations/20261009_1_client_view_planned_done_percent_hidden.ts`, `src/migrations/index.ts`

**Intent**: Copy `20261008_1_client_view_note_hidden.ts` with the key `plannedDonePercent`:

- `up` appends it to every array `hidden_columns` in `kosztorys_client_view` and
  `kosztorys_client_view_defaults`.
- `down` removes it.
- NULL sets already resolve to the code default, which leaves it unticked.

The migration is data only. `sanitizeClientViewSettings` drops an unknown key, so it is safe before or
after the deploy. Applied locally; prod is a human `pnpm db:migrate:prod`.

**Contract**: The migration name is `20261009_1_client_view_planned_done_percent_hidden`.

#### 4. Specs

**Files**: `src/__tests__/lib/kosztorys/client-view/settings.test.ts`, `src/__tests__/lib/kosztorys/client-view/columns.test.ts`,
`src/__tests__/lib/kosztorys/print/offer.test.ts`

**Intent**:

- The default settings hide `plannedDonePercent`, which is the fail-closed reading the owner relies on.
- When unhidden, the print carries the column with the same percentage as the resolver.
- Any spec pinning the full `CLIENT_DOCUMENT_COLUMNS` order gets the new id.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view/settings.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view/columns.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/print/offer.test.ts`
- `pnpm payload migrate` applies `20261009_1_…` on the local DB, after `git status src/migrations`.

#### Manual Verification:

- Kosztorys → „Widok inwestora”: „% wykonania (względem przedmiaru ofertowego)” is in „Etapy i postęp”
  and unticked, both on an investment with saved settings and on one without.
- Ticking it shows the column on the podgląd after the existing „% wykonania”. „Generuj ofertę” prints
  the same column with the same values.
- Before any etap entry, the column is absent from the investor's document even when ticked.

---

## Phase 3: Worker-document ticks

### Overview

„Widok pracownika” offers „Przedmiar ofertowy” and „% wykonania (względem przedmiaru ofertowego)”,
both unticked. A ticked column reaches the worker's link, the owner's Podgląd and the worker's PDF.

### Changes Required:

#### 1. Ceiling, order, comment

**File**: `src/lib/kosztorys/worker-view/columns.ts`

**Intent**:

- `WORKER_VIEW_GROUPS`:
  - add `plannedQty` to „Opis i ilości”, before `currentPlannedQty`;
  - rename „Etapy” to „Etapy i postęp” and add `plannedDonePercent` after the stage groups. This
    mirrors the investor dialog's group.
- `WORKER_DOCUMENT_COLUMNS`: add `plannedQty` before `currentPlannedQty`, and `plannedDonePercent`
  after `net`, before `remainingForPlane`.
- Rewrite the header comment's ofertowy sentence. The ofertowy is now a tick the managers decide on
  (2026-10-09), not absent by construction. The disclosure argument for the client price, rabat and
  brutto stays: a quantity and a ratio of quantities disclose no price.

#### 2. Default + legacy key

**File**: `src/lib/kosztorys/worker-view/settings.ts`

**Intent**:

- `WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns` becomes `['plannedQty', 'plannedDonePercent']`. A
  firm that never saved worker settings sees no new column.
- Delete `LEGACY_KEYS` / `currentKey` / `currentRanks`. A stored `plannedQty` now means the ofertowy.
  The prod row holds none (Current State Analysis), and the migration below rewrites any leftover
  first.

#### 3. Worker-surface numerator

**File**: `src/lib/kosztorys/columns/column-values.ts`

**Intent**: Inside the existing `if (executedQtyByItem)` block, override `plannedDonePercent` to divide
`executedQtyByItem[row.id] ?? 0` by the ofertowy. Without it, the worker surface, whose `stages` are
only his, would divide his own etapy and disagree with the editor's figure for the same pozycja. The
comment names `remainingForPlane` as the same reasoning. `stageQtySum` beside it stays his own etapy,
as today.

#### 4. Labels and tips

**Files**: `src/lib/kosztorys/columns/column-config.ts`, `src/lib/kosztorys/header-tips.ts`,
`src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**:

- Add `plannedDonePercent` to `TRANSLATED_LABEL_KEYS`, with a `grid.plannedDonePercent` label in all
  three dictionaries. The pl text is the `COLUMN_LABELS` text.
- Add `WORKER_TIP_KEYS` entries:
  - `plannedQty` → the existing `tipPlannedQty`;
  - `plannedDonePercent` → a new `tipPlannedDonePercent` in all three dictionaries. It says the figure
    counts every etap of the pozycja, not only his.

#### 5. Worker print

**File**: `src/lib/kosztorys/print/worker-columns.ts`

**Intent**: Add `plannedQty` (`PLANNED_QTY_COLUMN` with `labelOf('plannedQty')`) and
`plannedDonePercent` (`qtyColumn` + `formatPercent` over `valueOf('plannedDonePercent')`) to `byKey`.

#### 6. Data migration

**Files**: `src/migrations/20261009_2_worker_view_offer_columns_hidden.ts`, `src/migrations/index.ts`

**Intent**: On `kosztorys_worker_view_settings` rows whose `hidden_columns` is an array:

1. Rewrite a leftover `"plannedQty"` to `"currentPlannedQty"` in `hidden_columns` and as a
   `column_ranks` key. It is a no-op on prod today.
2. Append `"plannedQty"` and `"plannedDonePercent"` where they are absent.

`down` removes the two appended keys.

**Order: deploy first, migrate right after.** The old code still maps `plannedQty` →
`currentPlannedQty`, so migrating before the deploy would hide the Aktualizacja przedmiaru on every
worker document. Deploying first leaves the reverse window: the two new columns are visible on worker
documents until the migration runs. A quantity and a percentage disclose no price, so that window is
harmless.

#### 7. Specs

**Files**: `src/__tests__/lib/kosztorys/worker-view/settings.test.ts`,
`src/__tests__/lib/kosztorys/worker-view/columns.test.ts`, `src/__tests__/lib/kosztorys/print/worker.test.ts`,
`src/__tests__/lib/kosztorys/columns/column-values.test.ts`

**Intent**:

- Settings:
  - The default hides both new keys.
  - A stored `plannedQty` untick reads as the ofertowy. This replaces the legacy-key spec at `:55`,
    and the ceiling assertion at `:52` flips.
  - The client `price` stays outside the ceiling.
- Resolver: with `executedQtyByItem`, the worker figure divides the all-etapy quantity even when
  `stages` holds only his etap.
- Print: both columns print when unhidden, and neither prints at the default.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-view/settings.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-view/columns.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/columns/column-values.test.ts`
- `pnpm payload migrate` applies `20261009_2_…` on the local DB, after `git status src/migrations`.

#### Manual Verification:

- Kosztorys → „Widok pracownika”: „Przedmiar ofertowy” sits in „Opis i ilości” and the new percentage
  in „Etapy i postęp”. Both are unticked, and the existing ticks keep their state, including
  „Pozostało netto” unticked.
- Tick both and save. The worker's link and „Podgląd pracownika” show them in that order, and his PDF
  prints them.
- On a pozycja where another crew also has an etap, the worker's percentage equals the editor's figure
  for that pozycja, not just his share.
- The worker link at 390px is still readable with both extra columns ticked.
- A worker link in Українська shows a translated header and tip for the new percentage.

---

## Testing Strategy

### Unit Tests:

- Resolver: ofertowy divisor vs aktualizacja divisor on one row; `null` for ofertowy 0 / null / negative.
- Settlement hiding: hidden before the first entry, shown after.
- Investor settings: unticked by default, fail-closed.
- Print: column present when unticked-hidden is lifted.

### Manual Testing Steps:

See each phase's Manual Verification. Run them locally on the 5435 DB, on an investment from the dump
with a filled etap and a worker-report pozycja.

## Performance Considerations

One more resolver entry over a pomiar already memoised per row (`clientQtyDone`). That is negligible,
even at 1000+ rows.

## Migration Notes

Both migrations are data-only and owed to prod only when their phase ships. A human applies them.

- `20261009_1`: client view. Order-independent (Phase 2 §3).
- `20261009_2`: worker view. **Deploy first, then migrate right away** (Phase 3 §6).

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

The full `pnpm test` is not run unasked.

## References

- EX-921 (Przedmiar ofertowy / Aktualizacja przedmiaru): `context/archive/2026-10-07-kosztorys-przedmiar-aktualny/change.md`
- Neighbour column: `src/lib/kosztorys/columns/column-values.ts:68`
- Hidden-key migration precedent: `src/migrations/20261008_1_client_view_note_hidden.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The figure and the editor column

#### Automated

- [ ] 1.1 Resolver spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/columns/column-values.test.ts`
- [ ] 1.2 Settlement spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-columns.test.ts`
- [ ] 1.3 Touched grid specs pass

### Phase 2: Investor-document tick

#### Automated

- [ ] 2.1 Client-view specs pass: `settings.test.ts`, `columns.test.ts`
- [ ] 2.2 Print spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/offer.test.ts`
- [x] 2.3 Migration applies locally

### Phase 3: Worker-document ticks

#### Automated

- [ ] 3.1 Worker settings + columns specs pass
- [ ] 3.2 Worker print spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts`
- [ ] 3.3 Resolver spec (worker numerator) passes
- [x] 3.4 Migration applies locally
