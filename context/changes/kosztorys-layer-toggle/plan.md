# Work/Progress Column Reading-Axis Toggle — Implementation Plan

## Overview

Add a fourth column reading-axis to the kosztorys v2 editor: a **Praca / Postęp / Bez filtra**
(work / progress / both) segmented toggle that hides or shows the progress-tracker columns
independently of the existing three axes (column picker, netto/brutto, kwoty/%). Columns are
assigned to a layer **by identity via a map**, never by grid position, so reordered or newly-added
columns keep targeting correctly.

## Current State Analysis

The editor already stacks three reading axes on top of the base column picker, each built from the
identical parts. The new layer axis is a fourth instance of that same pattern:

| Axis                               | Type + default (`src/lib/kosztorys/…`)              | Column map (`constants.ts`)              | localStorage hook (`components/kosztorys/…`) | Toolbar options                                 |
| ---------------------------------- | --------------------------------------------------- | ---------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Money (netto/brutto)               | `money-axis.ts` `MoneyAxisT` `'both'`               | `COLUMN_MONEY_AXIS`                      | `use-money-axis.ts`                          | `MONEY_AXES` / `AXIS_LEGEND`                    |
| Progress display (kwoty/%)         | `progress-display.ts` `ProgressDisplayT` `'values'` | `COLUMN_PROGRESS_DISPLAY`                | `use-progress-display.ts`                    | `PROGRESS_DISPLAYS` / `PROGRESS_DISPLAY_LEGEND` |
| **Layer (praca/postęp)** — **new** | `layer.ts` `LayerT` `'both'`                        | `COLUMN_LAYER` + `LAYER_NEUTRAL_COLUMNS` | `use-layer.ts`                               | `LAYERS` / `LAYER_LEGEND`                       |

All three converge in one predicate in `buildV2Columns` (`src/lib/tables/kosztorys-v2-columns.tsx:769-772`):

```ts
const key = toggleKey(c.id ?? '')
return !opts.isHidden?.(key) && axisAllows(key, axis) && progressDisplayAllows(key, display)
```

They are threaded through `useKosztorysEditor` (`src/components/kosztorys/use-kosztorys-editor.ts`):
consumed from their hooks (lines 111-112), packed into `columnOpts` (lines 147-148), passed to the
single `buildV2Columns` / `buildV2ToggleItems` call sites (lines 157-158), and re-exported for the
toolbar (lines 550-552). The toolbar renders the toggles in `kosztorys-toolbar-view-toggles.tsx:27-40`.

### Key Discoveries:

- **`toggleKey` collapses per-stage columns to a group id** (`kosztorys-v2-columns.tsx:754-763`), so
  the money/progress maps are keyed by the group constant (`stageValueNet`, not `stageValueNet_7`).
  `COLUMN_LAYER` must follow the same keying. This is also why layer, like the others, is reorder- and
  new-stage-safe: a fresh stage's column inherits its group's tag, never a dead stage id's state.
- **Fail-open contract**: `axisAllows` returns `true` for any key absent from its map (`money-axis.ts:12-17`).
  A forgotten tag shows a column, never hides one. `layerAllows` keeps this contract.
- **State is a per-person localStorage preference, not per-kosztorys** — the storage key carries no
  investment id (`use-money-axis.ts:6-13`). Same for the new hook.
- **The money-axis 3-state works because BOTH sides are tagged** (`net` and `gross`). The layer axis
  tags only progress columns, so a real "Postęp hides work" state needs a neutral allowlist — see
  Critical Implementation Details.

## Desired End State

A fourth segmented toggle sits after the Etapy toggle in the editor toolbar. **Bez filtra** shows all
columns (default). **Praca** hides the progress-tracker columns (per-stage kwoty/brutto/%, % wykonania,
Pozostało). **Postęp** hides the work columns (Przedmiar, ceny, rabat, Wartość przedmiar, Netto/Brutto,
etapy-ilość inputs) while keeping the always-visible context (Sekcja, Opis prac, Pomiar) and showing
the progress tracker. The choice persists across reloads and composes with the other three axes without
conflict. Adding a new column later requires no toggle change — it's neutral until tagged.

## What We're NOT Doing

- No change to `KosztorysProgressCounter` or any figure/calculation — layer is purely column visibility.
- No reordering of columns in `assembleV2Columns`; the tracker columns are already contiguous at the
  right, but the toggle is identity-based and does not depend on that.
- No per-kosztorys / server-side persistence — matches the existing localStorage-preference model.
- No new picker entries; the layer axis composes with the picker, it does not replace it.
- No data model, schema, or migration changes.

## Implementation Approach

Clone the money-axis stack for a `layer` axis, with one deviation: because only progress columns are
tagged, `layerAllows` consults a small `LAYER_NEUTRAL_COLUMNS` allowlist so that "Postęp" can hide the
untagged work columns while keeping identity/context always visible. Phase 1 lands the headless axis
logic + unit test; Phase 2 lands the localStorage hook, toolbar option, and editor wiring.

## Critical Implementation Details

**Three-bucket semantics from a single-sided tag.** `COLUMN_LAYER` tags only progress columns.
`layerAllows` derives the three buckets:

```ts
export type LayerT = 'work' | 'progress' | 'both'
export const LAYER_DEFAULT: LayerT = 'both'

export function layerAllows(toggleKey: string, layer: LayerT): boolean {
  if (layer === 'both' || LAYER_NEUTRAL_COLUMNS.has(toggleKey)) return true
  const isProgress = COLUMN_LAYER[toggleKey] === 'progress'
  return layer === 'progress' ? isProgress : !isProgress
}
```

- `both` → everything (fail-open preserved).
- `work` → neutral + everything NOT tagged progress (the untagged work columns).
- `progress` → neutral + only progress-tagged columns.

`LAYER_NEUTRAL_COLUMNS` is the always-visible context: `sectionName`, `description`, `stageQtySum`
(Pomiar). Keyed by `toggleKey`. This mirrors how `AXIS_EXEMPT_COLUMNS` layers policy over
`COLUMN_MONEY_AXIS` (`constants.ts:113-116`).

**Column → layer assignment** (keyed by `toggleKey`):

| `toggleKey`                                                                                                                         | Bucket                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `sectionName`, `description`, `stageQtySum`                                                                                         | neutral (always visible)         |
| `stageValueNet`, `stageValueGross`, `stageValuePercent`, `donePercent`, `remaining`, `remainingGross`                               | **progress** (in `COLUMN_LAYER`) |
| everything else (`stages` (etapy-ilość), `plannedQty`, `unit`, `price*`, `discount*`, `plannedNet`, `plannedGross`, `net`, `gross`) | work (untagged)                  |

Note `remaining` **and** `remainingGross` are both tagged — Pozostało is two columns, not one group.

---

## Phase 1: Layer axis logic (headless)

### Overview

Add the `COLUMN_LAYER` map + neutral allowlist, the `layer.ts` module, and wire `layerAllows` into the
`buildV2Columns` filter. Cover it with a unit test mirroring the money-axis test.

### Changes Required:

#### 1. Layer column map + neutral allowlist

**File**: `src/lib/kosztorys/constants.ts`

**Intent**: Declare which columns are the progress tracker (`COLUMN_LAYER`) and which are always-visible
context (`LAYER_NEUTRAL_COLUMNS`), keyed by `toggleKey`, beside the existing `COLUMN_MONEY_AXIS` /
`COLUMN_PROGRESS_DISPLAY` maps so all axis policy lives in one file.

**Contract**: `export const COLUMN_LAYER: Record<string, 'work' | 'progress'>` tagging the six progress
keys from the assignment table (only `'progress'` values needed; a `'work'` value is unnecessary — untagged
already means work). `export const LAYER_NEUTRAL_COLUMNS: ReadonlySet<string> = new Set(['sectionName', 'description', 'stageQtySum'])`.
Use the existing `STAGE_VALUE_*_COLUMN_GROUP` constants as keys for the per-stage entries, matching
`COLUMN_MONEY_AXIS`.

#### 2. Layer axis module

**File**: `src/lib/kosztorys/layer.ts` (new)

**Intent**: The layer reading axis — type, default, and the `layerAllows` predicate — mirroring
`money-axis.ts` / `progress-display.ts` with a header comment stating it is the fourth reading axis and
composes with the others.

**Contract**: `LayerT = 'work' | 'progress' | 'both'`; `LAYER_DEFAULT: LayerT = 'both'`;
`layerAllows(toggleKey: string, layer: LayerT): boolean` per the snippet in Critical Implementation
Details. Imports `COLUMN_LAYER` and `LAYER_NEUTRAL_COLUMNS` from `constants.ts`.

#### 3. Compose into the column filter

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Add the layer axis to `BuildV2ColumnsOptsT` and the filter predicate in `buildV2Columns`, so
it composes with the picker and the other two axes.

**Contract**: Add `layer?: LayerT` to `BuildV2ColumnsOptsT` (import `LayerT`, `LAYER_DEFAULT`,
`layerAllows` from `@/lib/kosztorys/layer`). In `buildV2Columns`, resolve `const layer = opts.layer ?? LAYER_DEFAULT`
and append `&& layerAllows(key, layer)` to the existing filter return (line 771). `buildV2ToggleItems`
is unaffected — layer never removes picker entries.

#### 4. Unit test

**File**: `src/__tests__/kosztorys-layer.test.ts` (new)

**Intent**: Lock the three-bucket semantics and the neutral allowlist so the derived-from-single-tag
logic can't silently regress.

**Contract**: Mirror `src/__tests__/kosztorys-money-axis.test.ts` structure. Assert: `both` shows all;
`work` hides every progress column but keeps neutral + work; `progress` hides every work column but keeps
neutral + progress; a column absent from all maps (fail-open) shows under `work` and hides under
`progress` (documents that untagged == work); `sectionName`/`description`/`stageQtySum` show under all
three. Drive via `buildV2Columns` (as the money-axis test does) or `layerAllows` directly.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` (or the repo's typecheck script)
- Linting passes: `pnpm lint`
- New unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-layer.test.ts`
- Existing axis tests still pass: `pnpm exec vitest run src/__tests__/kosztorys-money-axis.test.ts`

#### Manual Verification:

- None for this phase — it is headless logic verified by the unit test.

**Implementation Note**: After automated verification passes, proceed to Phase 2 (no manual step here).

---

## Phase 2: UI toggle + editor wiring

### Overview

Add the localStorage hook, the toolbar options/legend, the toggle itself (appended after Etapy), and
thread the state through `useKosztorysEditor` into `columnOpts`.

### Changes Required:

#### 1. Layer preference hook

**File**: `src/components/kosztorys/use-layer.ts` (new)

**Intent**: Persist the layer choice as a per-person localStorage preference, identical mechanism to
`use-money-axis.ts` (`useSyncExternalStore`, same-tab listener set, no investment id in the key).

**Contract**: `useLayer(): [LayerT, (next: LayerT) => void]`. Storage key
`'table-columns:kosztorys-layer'`. Default `LAYER_DEFAULT`. Copy `use-money-axis.ts` and swap the type,
key, and default.

#### 2. Toolbar options + legend

**File**: `src/components/kosztorys/kosztorys-toolbar-options.tsx`

**Intent**: Declare the three segments and the tooltip for the new toggle, beside `MONEY_AXES` /
`PROGRESS_DISPLAYS`.

**Contract**: `LAYERS` = ordered options `work → 'Praca'`, `progress → 'Postęp'`, `both → 'Bez filtra'`
(match the `value`/`label` shape of `MONEY_AXES`). `LAYER_LEGEND` tooltip string describing the toggle
(e.g. filters between the work columns and the progress tracker). Follow the existing const's typing so
it feeds `KosztorysToolbarToggle` unchanged.

#### 3. Render the toggle

**File**: `src/components/kosztorys/kosztorys-toolbar-view-toggles.tsx`

**Intent**: Add a fourth `KosztorysToolbarToggle`, appended after the Etapy toggle.

**Contract**: Read `layer` / `setLayer` from `useKosztorysEditorContext()` (as the file already reads
`moneyAxis` / `progressDisplay`). Render `<KosztorysToolbarToggle legend={LAYER_LEGEND} options={LAYERS}
value={layer} onChange={setLayer} aria-label="Widok tabeli" />` after the existing block (lines 34-40).

#### 4. Thread through the editor hook

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Consume `useLayer`, pack `layer` into `columnOpts`, and re-export `layer` / `setLayer` for
the toolbar — mirroring the money-axis wiring at lines 111-112, 147-148, 550-552.

**Contract**: `const [layer, setLayer] = useLayer()`; add `layer,` to the `columnOpts` object; add
`layer, setLayer,` to the hook's returned object.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`

#### Manual Verification:

- The fourth toggle renders after the Etapy toggle with segments Praca / Postęp / Bez filtra.
- **Bez filtra**: all columns visible (unchanged from today).
- **Praca**: per-stage kwoty/brutto/%, % wykonania, and Pozostało columns disappear; Przedmiar, ceny,
  Netto/Brutto, and etapy-ilość remain.
- **Postęp**: work columns (Przedmiar, ceny, rabat, Wartość przedmiar, Netto/Brutto, etapy-ilość) disappear;
  Sekcja, Opis prac, Pomiar stay visible and the progress tracker columns show.
- The choice survives a page reload.
- Composes with the netto/brutto and kwoty/% toggles and the column picker without a column getting
  stuck visible/hidden.

---

## Testing Strategy

### Unit Tests:

- `kosztorys-layer.test.ts` (Phase 1) — the three-bucket derivation, neutral allowlist, and fail-open,
  mirroring `kosztorys-money-axis.test.ts`.

### Manual Testing Steps:

1. Open a seeded kosztorys editor (e.g. `INV=6`), find the four toolbar toggles.
2. Flip the new toggle through Bez filtra → Praca → Postęp, confirming the column sets above.
3. Combine with netto/brutto = Netto and Etapy = % wykonania; confirm no contradiction.
4. Reload; confirm the last layer choice is restored.

## Migration Notes

None — no schema or data changes. Kosztorys data is throwaway pre-`main` regardless.

## References

- Similar implementation (the axis this clones): `src/lib/kosztorys/money-axis.ts`,
  `src/components/kosztorys/use-money-axis.ts`, `src/__tests__/kosztorys-money-axis.test.ts`
- Filter composition point: `src/lib/tables/kosztorys-v2-columns.tsx:765-775`
- Editor wiring: `src/components/kosztorys/use-kosztorys-editor.ts:111-112,147-148,157-158,550-552`
- Toolbar: `src/components/kosztorys/kosztorys-toolbar-view-toggles.tsx:27-40`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Layer axis logic (headless)

#### Automated

- [x] 1.1 Type checking passes — 4ee8c91
- [x] 1.2 Linting passes — 4ee8c91
- [x] 1.3 New unit test passes (`kosztorys-layer.test.ts`) — 4ee8c91
- [x] 1.4 Existing axis tests still pass (`kosztorys-money-axis.test.ts`) — 4ee8c91

### Phase 2: UI toggle + editor wiring

#### Automated

- [x] 2.1 Type checking passes — 451fe13
- [x] 2.2 Linting passes — 451fe13
- [x] 2.3 Full unit suite passes — 451fe13
