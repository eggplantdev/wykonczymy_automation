# Kosztorys toolbar → one "Widok" popover — Implementation Plan

## Overview

Collapse the v2 editor's four reading-axis toggles + `Kolumny` picker into **two** toolbar
controls: the existing `Widok cen` toggle (stays out) and one new `Widok` popover that holds
`Etapy` (radio), `Kwoty` (checkboxes), `Warstwy` (checkboxes), and `Kolumny` (checkboxes).
No new persisted state — the checkbox pairs are a skin over the existing tri-state hooks.

## Current State Analysis

- `kosztorys-toolbar-view-toggles.tsx` renders **four** `KosztorysToolbarToggle`s on the left
  (Widok cen, Kwoty, Etapy, Warstwy), reading `view/moneyAxis/progressDisplay/layer` from
  `useKosztorysEditorContext()`.
- `kosztorys-toolbar-actions.tsx` renders the `Kolumny` picker on the right:
  `<ColumnToggleMenu items={columnToggleItems} onToggle={toggleColumn} className="ml-0" />`.
- `ColumnToggleMenu` (`src/components/ui/column-toggle-menu.tsx`) is **shared with TanStack
  tables** via `column-toggle.tsx` — it must stay generic and untouched.
- The `dropdown-menu` primitive already exports `DropdownMenuRadioGroup`,
  `DropdownMenuRadioItem`, `DropdownMenuCheckboxItem` — no new UI primitive needed.
- Money/layer state hooks (`use-money-axis.ts`, `use-layer.ts`) persist a tri-state string
  (`'net'|'gross'|'both'` / `'work'|'progress'|'both'`) under the `table-columns:` localStorage
  family. `useProgressDisplay` is already pick-one (`'values'|'percent'`).

### Key Discoveries:

- Options arrays `MONEY_AXES` / `LAYERS` (`kosztorys-toolbar-options.tsx`) each carry a `'both'`
  entry that becomes implicit under checkboxes (= both boxes checked) — that entry is dropped.
  `VIEWS` (Widok cen) and `PROGRESS_DISPLAYS` (Etapy) are unchanged.
- The current picker keeps its menu open across toggles via `onSelect={(e) => e.preventDefault()}`
  on plain items — the new menu reuses that trick for its radio/checkbox items.
- `both` stays a valid value in `MoneyAxisT` / `LayerT` and remains the persisted default — only
  the _UI option_ for it disappears. No migration, no hook change.

## Desired End State

Toolbar left cluster reads `[ Widok cen: Klient | Z narzędziami | Bez narzędzi ]  [ Widok ▾ ]`.
Opening `Widok` shows four labeled sections with icon+label rows; toggling a box hides/shows the
matching columns immediately and persists across reloads exactly as today. The right actions
group no longer carries a `Kolumny` button.

## What We're NOT Doing

- Not touching `Widok cen` behaviour or price-view logic.
- Not touching the column-visibility / axis filter semantics in `buildV2Columns` — this is a
  toolbar-surface reshape only.
- Not changing `ColumnToggleMenu` (the shared generic) or the TanStack `ColumnToggle` adapter.
- Not changing persisted state, storage keys, or the axis type unions.
- No E2E (owner decision) — the only real logic is the pure mapper, which unit tests cover;
  wiring is verified by manual dogfooding.

## Implementation Approach

Two phases. Phase 1 lands the pure tri-state↔checkbox-pair mapper with its unit test (verifiable
in isolation). Phase 2 builds `KosztorysViewMenu`, rewires the toolbar to render it beside
`Widok cen`, removes the three axis toggles and the right-side `Kolumny` button, and trims the
`'both'` option out of the two options arrays.

## Phase 1: Tri-state ↔ checkbox-pair mapper

### Overview

A single pure module both union axes (money, layer) share, converting between a tri-state axis
value and a two-checkbox view, with a min-one-checked guard.

### Changes Required:

#### 1. Pair-axis mapper

**File**: `src/lib/kosztorys/axis-checkboxes.ts` (new)

**Intent**: Provide the derive (value → two booleans) and toggle (value + clicked box → next
value) logic once, generic over the axis string union, so `Kwoty` and `Warstwy` reuse it. The
toggle enforces min-one-checked: unchecking the last checked box is a no-op (there is no
"hide all" axis value and it would be a nonsense view).

**Contract**: Generic over `T extends string`, driven by a `{ a: T; b: T; both: T }` config.

```ts
export type PairChecksT = { a: boolean; b: boolean }
export type PairAxisConfigT<T extends string> = { a: T; b: T; both: T }

export function derivePairChecks<T extends string>(
  value: T,
  config: PairAxisConfigT<T>,
): PairChecksT
// togglePairAxis flips the clicked box; if that would clear both, returns `value` unchanged.
export function togglePairAxis<T extends string>(
  value: T,
  clicked: 'a' | 'b',
  config: PairAxisConfigT<T>,
): T
```

Money config `{ a: 'net', b: 'gross', both: 'both' }`; layer config `{ a: 'work', b: 'progress', both: 'both' }`.

#### 2. Unit test

**File**: `src/__tests__/kosztorys-axis-checkboxes.test.ts` (new)

**Intent**: Lock the mapper's behaviour for both axis configs.

**Contract**: Cover, per config — `derivePairChecks` for all three values; `togglePairAxis` for
every (value × clicked-box) pair including the min-1 no-op (unchecking the sole checked box
returns the same value); round-trip (`'both'` → uncheck a → `'net'`/`'work'` → re-check → `'both'`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- New unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-axis-checkboxes.test.ts`
- Linting passes: `pnpm lint`

#### Manual Verification:

- (none — pure logic, covered by the unit test)

---

## Phase 2: `KosztorysViewMenu` + toolbar rewire

### Overview

Build the grouped popover and swap it into the toolbar for the three axis toggles and the
right-side `Kolumny` button. Trim the now-implicit `'both'` option out of the options arrays.

### Changes Required:

#### 1. The grouped popover

**File**: `src/components/kosztorys/kosztorys-view-menu.tsx` (new)

**Intent**: One `DropdownMenu` (trigger button labelled `Widok`) with four labeled sections,
each keeping its native control type; consumes `useKosztorysEditorContext()` directly. Toggling
never closes the menu (`onSelect` preventDefault on every item).

**Contract**: Sections in order —

- **Etapy** — `DropdownMenuRadioGroup value={progressDisplay}`, two `DropdownMenuRadioItem`s
  (`values` / `percent`) from `PROGRESS_DISPLAYS`, `onValueChange → setProgressDisplay`.
- **Kwoty** — two `DropdownMenuCheckboxItem`s (Netto / Brutto), `checked` from
  `derivePairChecks(moneyAxis, MONEY_PAIR_CONFIG)`, click → `setMoneyAxis(togglePairAxis(...))`.
- **Warstwy** — same shape over `layer` / `setLayer` with `LAYER_PAIR_CONFIG` (Praca / Postęp).
- **Kolumny** — the existing `columnToggleItems` mapped as check rows, `onToggle → toggleColumn`
  (same item shape and check-icon presentation as the current `ColumnToggleMenu`).
  Each row shows the icon + label already defined in `kosztorys-toolbar-options.tsx`. `Separator`
  between sections; `DropdownMenuLabel` per section header.

#### 2. Options arrays lose the implicit `'both'`

**File**: `src/components/kosztorys/kosztorys-toolbar-options.tsx`

**Intent**: `MONEY_AXES` and `LAYERS` become the two checkbox rows each (drop the `'both'`
entry, which is now "both checked"). Reuse existing labels/icons/hints. Adjust `AXIS_LEGEND` /
`LAYER_LEGEND` wording so they no longer describe a "Bez filtra" option. `VIEWS` /
`PROGRESS_DISPLAYS` unchanged. Define/co-locate `MONEY_PAIR_CONFIG` and `LAYER_PAIR_CONFIG`
(or import from `axis-checkboxes` call sites) so the menu maps rows → axis values.

**Contract**: `MONEY_AXES` and `LAYERS` each drop their `both` element; no other consumer relies
on that element (verified by typecheck). Pair configs available to `kosztorys-view-menu.tsx`.

#### 3. Toolbar rewire — left cluster

**File**: `src/components/kosztorys/kosztorys-toolbar-view-toggles.tsx`

**Intent**: Render only the `Widok cen` toggle + `<KosztorysViewMenu />`. Remove the Kwoty,
Etapy, and Warstwy `KosztorysToolbarToggle`s and their now-unused context reads/imports.

**Contract**: Component returns `Widok cen` toggle followed by the `Widok` popover; only `view` /
`setView` still read here (the menu reads the rest itself).

#### 4. Toolbar rewire — remove right-side picker

**File**: `src/components/kosztorys/kosztorys-toolbar-actions.tsx`

**Intent**: Drop the `<ColumnToggleMenu … />` and its `columnToggleItems` / `toggleColumn`
context reads + import (now owned by `KosztorysViewMenu`). Leave the progress counter, actions
menu, and Sekcje button intact.

**Contract**: `ColumnToggleMenu` import removed from this file; `columnToggleItems` / `toggleColumn`
no longer destructured here.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Full unit suite passes: `pnpm exec vitest run`
- Linting passes: `pnpm lint`

#### Manual Verification:

- `Widok` popover opens; four sections render with icon+label rows.
- Kwoty: unchecking Netto hides netto columns; unchecking the last checked box is refused (a box
  always stays checked). Same for Warstwy (Praca / Postęp).
- Etapy radio switches stage columns between Kwoty and % wykonania.
- Kolumny rows hide/show individual columns; menu stays open across multiple toggles.
- Selections persist across a page reload (same as before).
- Toolbar left cluster reads `Widok cen` + `Widok`; no stray toggles; right group no longer has
  a `Kolumny` button.

---

## Testing Strategy

### Unit Tests:

- `axis-checkboxes.ts` — derive for all values, toggle for all (value × box) incl. min-1 no-op,
  round-trip, for both money and layer configs.

### Manual Testing Steps:

1. Open a kosztorys editor; confirm the left cluster is `Widok cen` + `Widok`.
2. In `Widok`, toggle each Kwoty / Warstwy box; confirm columns react and the last box can't be
   cleared.
3. Flip Etapy radio; confirm stage columns swap Kwoty ↔ %.
4. Toggle several Kolumny rows without the menu closing.
5. Reload; confirm every selection survived.

## References

- Design brief: `context/changes/kosztorys-toolbar-view-menu/design.md`
- Shared generic picker (do not touch): `src/components/ui/column-toggle-menu.tsx:20`
- Money-axis hook pattern: `src/components/kosztorys/use-money-axis.ts:46`
- Toolbar hosts: `src/components/kosztorys/kosztorys-toolbar-view-toggles.tsx`,
  `src/components/kosztorys/kosztorys-toolbar-actions.tsx:35`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Tri-state ↔ checkbox-pair mapper

#### Automated

- [x] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [x] 1.2 New unit test passes: `pnpm exec vitest run src/__tests__/kosztorys-axis-checkboxes.test.ts`
- [x] 1.3 Linting passes: `pnpm lint`

### Phase 2: `KosztorysViewMenu` + toolbar rewire

#### Automated

- [ ] 2.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [ ] 2.2 Full unit suite passes: `pnpm exec vitest run`
- [ ] 2.3 Linting passes: `pnpm lint`
