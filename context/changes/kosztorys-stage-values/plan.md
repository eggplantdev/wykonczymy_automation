# Per-stage value columns (netto + brutto) Implementation Plan

## Overview

The grid renders one column per stage — a qty input. The reference sheet renders two axes: `D–M`
etap **ilość** and `V–AE` etap **wartość**, then `AF` pozostało. This plan surfaces the missing
`V–AE` half as two computed columns per stage (netto + brutto), reorders the grid to the owner's
layout, and splits the single `Etapy` picker entry into three groups.

Presentation-only. The math already exists and is already tested.

## Current State Analysis

Lifted from `research.md` and `frame.md` — not re-derived.

- **The math is done.** `stageValueForView` (`calc.ts:77`) is the sheet's
  `V = D5*$Q5-(D5*$Q5*$R5)` verbatim, and is **already tested** across all three price views plus a
  percent discount (`kosztorys-calc.test.ts:37-47`). It is called today only by `rowDoneNetForView`
  (`v2-rows.ts:319`) to feed `Pozostało`. It is never surfaced.
- **Brutto is a render transform, nothing more.** It has no row field, no calc function, no
  serialization, no DB column — only `investments.vat_rate` denormalized onto every row. All five
  existing pairs derive it inline as `× (1 + r.vatRate)` (`kosztorys-v2-columns.tsx:547,559,587,600,613`).
  A `brutto = netto × (1 + vatRate)` test block already exists (`kosztorys-calc.test.ts:140`).
- **`computedColumn` receives the whole row** (`:183-197`, `component: ({ rowData }) => fmt(compute(rowData))`,
  `disabled: true`). No row field is needed — which is exactly what keeps `diffRow` safe.
- **The `stage_` prefix is load-bearing in two branches**: `toggleKey` (`:623-625`) collapses any
  `stage_*` id into the single picker entry; `diffRow` (`v2-rows.ts:91-98`) classifies **every key on
  the row object** by that prefix alone, with no `ITEM_FIELDS`-style allowlist.
- **The order comment is already wrong** (`:618`): it claims `opis → etapy → przedmiar` but
  `identity` leads with `sectionName`. This plan rewrites the line anyway.
- **The picker already handles many-columns-to-one-entry** — `buildV2ToggleItems` (`:636-644`)
  dedupes on `toggleKey`.
- **`dropWidth` exists precisely because Postgres reissues stage ids** (`use-column-widths.ts:52-60`),
  and is called once per removed stage from `handleRemoveStage` (`use-kosztorys-editor.ts:346`).
- **The hidden map is sparse and global**, `absent = visible` (`use-hidden-columns.ts:5-6,55-64`),
  `localStorage: 'table-columns:kosztorys'`.

## Desired End State

At 3 stages in the client view, the grid reads left-to-right:

```
Sekcja | Opis | Przedmiar | Pomiar | J.m. | Etap 1 | Etap 2 | Etap 3
      | Cena j.m. netto | Cena j.m. brutto | Rabat wart. | Rabat | Rabat kwota netto | Rabat kwota brutto
      | Wartość przedmiaru netto | Wartość przedmiaru brutto | Netto | Brutto
      | Etap 1 — netto | Etap 2 — netto | Etap 3 — netto
      | Etap 1 — brutto | Etap 2 — brutto | Etap 3 — brutto        ← hidden by default
      | Pozostało netto | Pozostało brutto
```

Verify: type a qty into `Etap 1` on a row priced 20 zł with no rabat → `Etap 1 — netto` shows
`qty × 20`, and `Pozostało netto` drops by the same amount. Rename the stage → all three headers
follow. Delete it → all three columns go, and no width entry is orphaned. The picker lists three
`Etapy` entries; `Etapy — kwota brutto` starts unchecked.

### Key Discoveries:

- `stageValueForView` (`calc.ts:77`) already exists and is tested — this change surfaces it, it does
  not compute anything new.
- The value headers are **read-only text**, so the `stage-header.tsx:24` index-identity trap
  (uncontrolled input + dsg keying header cells by column index → wrong-stage rename) **cannot reach
  them**. Only the qty column keeps that hazard, and it is already fixed.
- Column-set changes are **reactive and free** — the editor is on `DynamicDataSheetGrid`
  (`kosztorys-editor-body.tsx:7`). **Never add a remount `key`** (`lessons.md:119-135`, `ee497cb`) —
  the remount WAS the EX-422 flicker.
- `sortValue` (`use-kosztorys-editor.ts:68-86`) wires only `price`/`net`/`remaining`; the other 7
  computed columns render a live sort arrow that does nothing. Not this change's bug, but it is why
  the value columns get a plain non-sortable label.

## What We're NOT Doing

- **The netto/brutto shortcut (piece 2).** Split out by `/10x-frame`; its shaping is preserved in
  `change.md`. Its premise — that the grid is too wide — is what this change makes testable. Do not
  build it before dogfooding this.
- **Fixing the no-op sort on the 7 computed columns.** Pre-existing; file separately.
- **Fixing orphan width entries across tabs.** Pre-existing; file separately.
- **Any change to `sectionSubtotalsForView` or the footer's `Suma netto`/`Suma brutto`.** They are
  independent of the picker by design.
- **"Suma etapu"** (a total ALONG the stage axis) — Roadmap open question 12(b). The sheet has no
  such formula (verified: zero `SUM` over `V–AE` across 464 rows) and it needs an owner decision.
- **Sortability of the new columns**, and any `sortValue` restructuring.

## Implementation Approach

Follow `c468ec6` (Rabat kwota netto/brutto, 2 days old) — the precedent for exactly this shape:
`COLUMN_LABELS` entries + `computedColumn` calls, nothing else. Two departures, both forced:

1. **The stage axis is dynamic**, so the columns are `stages.map(...)` and the picker needs static
   group ids rather than per-stage entries (the ghost-id rationale at `constants.ts:50-52` still
   holds: Postgres reissues deleted stage ids).
2. **The id namespace must not start with `stage_`** — `stageValueNet_<id>` / `stageValueGross_<id>`.
   If it did, `toggleKey` would collapse the value columns into the qty group (unhideable
   separately), and `diffRow` would parse `Number('value_7')` → `NaN` → `setStageProgressAction(row.id,
NaN, qty)`, a save against a nonexistent stage. Computed columns never reach the row object, so
   the `diffRow` half is defence-in-depth — but the namespace choice is what makes it structural
   rather than incidental.

## Critical Implementation Details

**Compute at render, never store.** The per-stage value is
`stageValueForView(r, r[stageKey(st.id)] ?? 0, view)`. It must stay a `computedColumn` and must never
become a row field — that is the single rule keeping `diffRow`'s prefix loop (`v2-rows.ts:91-98`)
from firing bogus stage saves. `remaining` already proves the pattern (`:602-604`).

**Never add a remount `key` to the grid.** Column-set changes are reactive. See Key Discoveries.

---

## Phase 1: Stage value columns + grid reorder

### Overview

The feature: two computed columns per stage, the owner's column order, three picker groups, and
width cleanup for the two new ids. Both groups visible at the end of this phase — Phase 2 turns
brutto off.

### Changes Required:

#### 1. Picker group ids and labels

**File**: `src/lib/kosztorys/constants.ts`

**Intent**: The single `Etapy` picker entry becomes three, so the qty axis and each value axis hide
independently. Groups stay static strings, so no stage id enters the visibility map — preserving the
ghost-id rationale already documented at `:50-52`.

**Contract**: Add `STAGE_VALUE_NET_COLUMN_GROUP` / `STAGE_VALUE_GROSS_COLUMN_GROUP` alongside the
existing `STAGES_COLUMN_GROUP` (`:53`). Add matching `COLUMN_LABELS` entries next to `stages: 'Etapy'`
(`:47`): `'Etapy — ilość'`, `'Etapy — kwota netto'`, `'Etapy — kwota brutto'` — relabel `stages` from
`'Etapy'` to `'Etapy — ilość'` so the three read as a set. Extend the `:50-52` comment to say the
rationale now covers three groups.

#### 2. The value columns and the mirror header

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Surface `stageValueForView` as two computed columns per stage. The header is a read-only
mirror of the stage's name — one source for the name, so a rename moves all three headers and a
delete takes all three columns. Brutto derives inline, consistent with all five existing pairs.

**Contract**: Two new column groups built from `opts.stages`, ids `stageValueNet_<stageId>` and
`stageValueGross_<stageId>`, both via `computedColumn` (which supplies `disabled: true` and routes
through `fmt`). Header is a plain non-sortable node reading `${stage.label ?? \`Etap ${stage.ordinal}\`} — netto`/`— brutto`— **not**`title(...)`(that would inherit the no-op-sort bug) and **not**`StageHeader`(no rename/delete affordance on a mirror). Compute:`stageValueForView(r, r[stageKey(st.id)] ?? 0, view)`, and the brutto variant `× (1 + r.vatRate)`.
Reuse `stageKey`from`v2-rows.ts` to read the qty — do not re-derive the row key.

A zero-qty stage renders `0,00` like every other computed column (owner's call) — this needs no code,
it is what `fmt(0)` already does.

#### 3. Column order

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Move the stage qty block after `J.m.` and place the value block at the end, before
`Pozostało` — sheet parity for the value block, owner's deviation for the qty block.

**Contract**: Split the existing `pricing` array (`:531-561`) into a measure part (`plannedQty`,
`measuredQty`, `unit`) and a price part (`priceCols` onward), and the existing `computed` array
(`:580-616`) into a value part (`plannedNet`, `plannedGross`, `net`, `gross`) and a remaining part
(`remaining`, `remainingGross`). Final return order:

```
identity → measure → stageQty → price → value → stageValueNet → stageValueGross → remaining
```

Rewrite the order comment at `:618` — it is already factually wrong today (claims `opis → etapy →
przedmiar`; `identity` actually leads with `sectionName`). State the deviation: qty moves left out of
sheet order by owner's call, the value block keeps sheet order.

#### 4. Picker routing

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Route each of the three stage id namespaces to its own picker group.

**Contract**: `toggleKey` (`:623-625`) tests all three prefixes. No prefix is a prefix of another
(`stageValueNet_` / `stageValueGross_` / `stage_`), so the test is order-independent — say so in the
comment, because a reader will otherwise assume the `stage_` test must come last and preserve that
ordering as if it were load-bearing.

#### 5. Width cleanup on stage delete

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: A removed stage now leaves three width entries, not one. Without this, a reissued stage
id inherits the dead stage's widths — the exact ghost `constants.ts:50-52` warns about.

**Contract**: `handleRemoveStage` (`:346`) calls `dropWidth` for all three ids after the successful
server delete. Keep the existing after-success ordering — a failed delete must not drop widths.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing calc tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- Existing row tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`

#### Manual Verification:

- Type a qty into a stage on a seeded investment (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`) → `Etap N — netto` shows qty × cena − rabat, and `Pozostało netto` drops by the same amount
- `Etap N — brutto` = `Etap N — netto` × 1.08 at the default VAT rate
- Rename a stage → all three headers update; the qty header stays editable, both value headers do not
- Delete a stage → all three columns disappear; the remaining stages keep their own labels (the wrong-stage-rename class)
- Switch price view (Klient / Z narzędziami / Bez narzędzi) → stage values reprice, no flicker, no scroll or selection loss
- The picker lists three `Etapy` entries; each hides its own block independently
- Column order matches the Desired End State layout

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Default-hidden columns

### Overview

Ship `Etapy — kwota brutto` off by default without seeding anyone's localStorage.

### Changes Required:

#### 1. The `absent = default` invariant

**File**: `src/components/kosztorys/use-hidden-columns.ts`

**Intent**: Today `absent = visible`, so a default-hidden column would have to be seeded into the
stored map — which freezes the default into every user's localStorage and makes a seeded default
indistinguishable from a deliberate choice. Shifting the invariant to `absent = default` keeps the
map sparse, needs no migration, and leaves the default declared in code where it can change later.

**Contract**: Add a `DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string>` (next to `NON_HIDEABLE_COLUMNS` in
`constants.ts`) containing `STAGE_VALUE_GROSS_COLUMN_GROUP`. `isHidden` (`:55-57`) becomes
`hidden[id] ?? DEFAULT_HIDDEN_COLUMNS.has(id)`. `toggleColumn` (`:59-64`) writes an explicit boolean
(`next[id] = !isHidden(id)`) instead of deleting the key to unhide — deleting would now mean "revert
to default", not "show".

Backwards compatibility is free and worth stating in the comment: stored maps only ever contain
`true` entries, and `true` still means hidden under the new rule. Update the `:5-6` header comment —
it currently asserts the old invariant verbatim ("Sparse: only columns explicitly switched off get an
entry, so a new column ships visible without a migration").

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`

#### Manual Verification:

- With no prior localStorage (fresh profile / cleared `table-columns:kosztorys`): the grid opens with `Etapy — kwota netto` visible and `Etapy — kwota brutto` hidden
- The picker shows `Etapy — kwota brutto` unchecked; checking it reveals the columns and survives a reload
- Un-checking it again hides them and survives a reload
- An existing profile with columns already hidden keeps exactly those columns hidden (no regression from the invariant change)

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 3: Doc reconciliation

### Overview

Three documents are left factually wrong by this change or were found wrong during its frame. Per
`AGENTS.md`, living docs get corrected when a change makes them wrong.

### Changes Required:

#### 1. P8 is answered

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: P8 (`:298` — "Brutto/VAT dotyczy wszystkich wariantów ceny, czy tylko ceny klienta?") was
answered by the owner during this change's frame: **all three views, at the investment's rate**. It
should stop being an open question.

**Contract**: Move P8 out of the OPEN section and record the answer, its date (2026-07-15), and that
it resolves the contradiction between `context/archive/2026-07-10-kosztorys-vat/plan-brief.md:33`
("the tax-inclusive total is the client-decision figure") and that slice's shipped `plan.md:232`
("Brutto consistent across all three price views") — in favour of the shipped behaviour. Also record
the verified `V–AE` / `AF` sheet column map if the notes still lack it.

#### 2. S-03's reversed exclusion and stale dsg claim

**File**: `context/changes/kosztorys-stages/plan.md`

**Intent**: S-03 is still `in review`, so its plan should not contradict shipped behaviour. It
excludes "VAT / brutto on stage values — no brutto column" (reversed by the owner 2026-07-15), and
carries the remount-key claim that `ee497cb` superseded (Key Discoveries + Phase 4 §3, incl. manual
row 4.5's "Add stage → new column (remount-key)" wording).

**Contract**: Annotate — do not rewrite history. Mark the exclusion as superseded by this change with
a pointer, and mark the remount-key claim as superseded by `ee497cb` / `lessons.md:119-135`. Leave
the unchecked manual rows 4.5–4.10 alone; they are S-03's to discharge.

#### 3. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Keep the slice status honest about what shipped.

**Contract**: Note the per-stage value columns against the relevant slice. Leave open question 12(b)
("suma etapu") open — it is explicitly out of scope here. Preserve strict numeric slice order.

### Success Criteria:

#### Automated Verification:

- Linting passes: `pnpm lint`

#### Manual Verification:

- `context/reference/kosztorys-editor-domain-notes.md` no longer lists P8 as open, and its answer names the date and the resolved contradiction
- `context/changes/kosztorys-stages/plan.md` no longer asserts a remount key is needed, and its brutto exclusion is marked superseded
- No living doc still claims stage values are netto-only

---

## Testing Strategy

The calc layer is already covered and this change does not touch it — `stageValueForView` has tests
for all three views and percent discount (`kosztorys-calc.test.ts:37-47`), and
`brutto = netto × (1 + vatRate)` has its own block (`:140`). Adding a test that re-asserts
`stageValueForView(...) * 1.08` would test arithmetic, not this change.

What this change actually risks is **column wiring**, and the honest signal for that is the manual
pass — specifically the rename/delete behaviour across three columns, which is where the
index-identity trap lives.

### Unit Tests:

- No new unit tests. The math is covered; the delta is presentation.

### Integration Tests:

- None. No server action, query, or DB path changes.

### Manual Testing Steps:

1. Seed: `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`
2. Open the kosztorys editor for investment 6, add 2–3 stages
3. Enter a qty in `Etap 1` on a row with a known price and no rabat → verify `Etap 1 — netto`, and that `Pozostało netto` drops by the same amount
4. Add a percent rabat to that row → verify the stage value drops proportionally (it is post-discount)
5. Rename `Etap 1` → all three headers follow; only the qty header is editable
6. Delete `Etap 1` → all three columns go; `Etap 2` keeps its own label (not `Etap 1`'s)
7. Switch price views → values reprice; no flicker, no scroll/selection loss
8. Toggle each of the three picker groups independently; reload and confirm each choice persisted
9. Perf sanity at scale: `INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`, then scroll the ~1000-row grid with all three stage groups visible

## Performance Considerations

The stage block goes from N to 3N columns. Each value cell calls `stageValueForView`, an O(1)
arithmetic function on data already on the row — no new fetch, no new reduce. `Pozostało` already
does strictly more work per cell (`rowDoneNetForView` is an O(stages) reduce, `v2-rows.ts:313-322`),
and dsg virtualizes columns as well as rows.

The real risk is horizontal: at 10 stages the grid carries ~47 columns in the client view. Phase 2's
default takes ~10 of those off the initial render. Step 9 of the manual pass is the check that
matters — this change ships the width cost unmitigated by design, because the frame found the
argument for mitigating it pre-emptively (piece 2) to be circular.

## Migration Notes

No schema, no data migration. The new columns are computed and never persist. Snapshots, presets, and
serialization operate on DB entities only and are untouched (`serialize-kosztorys.ts`,
`restore-kosztorys.ts`, `snapshot-format.ts`, `apply-preset.ts`).

Phase 2 changes the meaning of an **absent** key in `table-columns:kosztorys` from "visible" to
"default". Stored maps contain only `true` entries, which mean hidden under both rules — so existing
preferences carry over unchanged and no migration or seed is required.

## References

- Frame: `context/changes/kosztorys-stage-values/frame.md`
- Research: `context/changes/kosztorys-stage-values/research.md`
- Precedent to copy: `c468ec6` — Rabat kwota netto/brutto (`calc.ts` + `constants.ts` + `kosztorys-v2-columns.tsx`, nothing else)
- `src/lib/kosztorys/calc.ts:77` — `stageValueForView`, the sheet's `V` verbatim
- `src/lib/tables/kosztorys-v2-columns.tsx:183-197` — `computedColumn`
- `src/lib/tables/kosztorys-v2-columns.tsx:563-578` — the current single stage column
- `src/lib/kosztorys/v2-rows.ts:91-98` — `diffRow`'s prefix loop (the `NaN` hazard)
- `src/components/kosztorys/stage-header.tsx:14-20` — the index-identity rationale
- `context/foundation/lessons.md:119-135` — the dsg export alias; never add a remount key

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stage value columns + grid reorder

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 870f883
- [x] 1.2 Linting passes: `pnpm lint` — 870f883
- [x] 1.3 Existing calc tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts` — 870f883
- [x] 1.4 Existing row tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts` — 870f883

### Phase 2: Default-hidden columns

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck`
- [x] 2.2 Linting passes: `pnpm lint`
- [x] 2.3 Full unit suite passes: `pnpm exec vitest run`

### Phase 3: Doc reconciliation

#### Automated

- [ ] 3.1 Linting passes: `pnpm lint`
