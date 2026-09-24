# „Pokaż wszystkie pozycje" in the client view — Implementation Plan

## Overview

An investor-facing switch in the client view (`/k/[token]` and „Podgląd dla inwestora") that lifts the
owner's „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" for the current visit. It exists for the
curious investor who wants to see the whole scope of works on offer, not only what this offer prices.
The revealed pozycje render muted, so „oferowane, ale nie w zakresie" reads apart from the offer.

## Current State Analysis

- The owner stores the decision per variant as `hideEmptyRows` in the „Inwestor" settings dialog
  (`src/components/kosztorys/editor/dialogs/client-view-settings-form.tsx:91`, default `true`).
- Both client routes render `<KosztorysEditorBody preview />`
  (`src/app/(share)/k/[token]/page.tsx`, `src/app/(share)/podglad-inwestora/[id]/page.tsx`).
- The preview payload ships the **full** tree (`src/lib/queries/preview-kosztorys.ts:25`); hiding is
  render-side only, so revealing needs no request.
- The wiring stored flag → engaged condition → rows removed is:
  `useKosztorysViewState` (`hooks/use-kosztorys-view-state.ts:45`) →
  `clientConditionIds(clientView?.hideEmptyRows)` (`lib/kosztorys/row-conditions/queries.ts:228`) →
  `documentRows = applyRowConditions(...)` (`use-kosztorys-editor.ts:527`).
- Under preview every row-condition count is forced to `0` (`use-kosztorys-editor.ts:425`), so there is
  no `client-empty` count available to the client header today.
- The preview header (`kosztorys-editor-body.tsx:378`) holds only `KosztorysTotalsPanelToggle`.
- There is no `Switch` primitive in `src/components/ui/`; `radix-ui` (^1.4.3) is installed and ships one.
- Per-row styling goes through `rowClassName` (`kosztorys-editor-body.tsx:446`) plus
  `.kosztorys-grid .dsg-row.<class>` rules in `src/styles/globals.css` (see `kosztorys-section-footer`).

## Desired End State

With `hideEmptyRows` on and at least one empty pozycja, the client header shows a switch
„Pokaż wszystkie pozycje (+N)". Switching it on puts the hidden pozycje back into the grid in muted
text, numbered in sequence with the rest; switching it off restores the curated list. A reload always
opens curated. Podsumowanie, section totals and the printed offer are unchanged either way. With
`hideEmptyRows` off, or nothing to reveal, no switch renders.

### Key Discoveries:

- `clientConditionIds` is the guarded single point deciding what reaches a client
  (`queries.test.ts:270` explains why it moved out of the hook). The switch feeds it `false`; it does
  not bypass it.
- `countMatching` (`queries.ts:140`) counts; nothing returns the matching **ids**, which the muted style
  needs. One helper returning ids serves both the count (`.size`) and the style.
- Hidden pozycje are 0 zł on every figure (`registry.ts` `client-empty` rationale), so revealing them
  cannot move a total.

## What We're NOT Doing

- No persistence (plain `useState`): every visit opens on the owner's curated view.
- Not tied to the Oferta/Rozliczenie variant: the client sees one variant, the switch overrides it.
- Not touching the print (`build-offer-print-html.ts:250` keeps reading the stored flag).
- No owner-side setting to allow/forbid the switch.
- Not un-zeroing any other condition count under preview.

## Implementation Approach

State lives in `useKosztorysViewState` beside the other reading gestures; the editor hook derives the
set of `client-empty` row ids once (under preview with `hideEmptyRows` on) and exposes the state, the
setter and that set. The body renders the switch from the set's size and marks a revealed row through
`rowClassName`.

## Phase 1: State and derivation

### Overview

The switch's state and the ids it reveals, guarded by specs, with no UI yet.

### Changes Required:

#### 1. View state

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts`

**Intent**: Hold `showAllRows` as local state and let it switch the client condition off under preview.

**Contract**: `engagedConditionIds = preview ? clientConditionIds(clientView?.hideEmptyRows && !showAllRows) : persisted`.
Return `showAllRows` and `setShowAllRows`. No effect on the owner's grid (`preview: false`).

#### 2. Matching ids helper

**File**: `src/lib/kosztorys/row-conditions/queries.ts`

**Intent**: Return the ids of the rows a condition matches, for callers that need to know _which_ rows
and not only how many.

**Contract**: `rowIdsMatching(rows, conditionId, ctx): ReadonlySet<number>`; an unknown id returns an
empty set, the same as `countMatching` returning 0.

#### 3. Editor hook

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Derive `clientEmptyRowIds` under preview when `clientView.hideEmptyRows` is on (empty set
otherwise, stable instance) and expose it with `showAllRows` / `setShowAllRows` in the return shape.
Do not change the preview zeroing of `rowConditionCounts`; the set's size is the count.

**Contract**: return gains `showAllRows: boolean`, `setShowAllRows(next: boolean)`,
`clientEmptyRowIds: ReadonlySet<number>`. Nothing moves into `KosztorysEditorProvider` (EX-521).

#### 4. Specs

**Files**: `src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-view-state.test.tsx`,
`src/__tests__/lib/kosztorys/row-conditions/queries.test.ts`

**Intent**: Guard that under preview with `hideEmptyRows` the client condition is engaged, that
`setShowAllRows(true)` disengages it, that it re-engages on `false`, and that the owner's grid ignores it.
Guard `rowIdsMatching` picks exactly the `client-empty` rows and returns empty for an unknown id.

### Success Criteria:

#### Automated Verification:

- View-state spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-view-state.test.tsx`
- Queries spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/queries.test.ts`

#### Manual Verification:

- None for this phase (no UI yet).

---

## Phase 2: Switch and muted rows

### Overview

The control in the client header and the muted look of revealed pozycje.

### Changes Required:

#### 1. Switch primitive

**File**: `src/components/ui/switch.tsx` (new)

**Intent**: The shadcn `Switch` over `radix-ui`'s Switch, domain-free, so the header has an on/off
control that shows its state.

**Contract**: `Switch` accepting Radix Switch root props (`checked`, `onCheckedChange`, `id`, `disabled`).

#### 2. Client header control

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Next to `KosztorysTotalsPanelToggle` in the preview header, render a labelled switch
„Pokaż wszystkie pozycje (+N)" where N = `clientEmptyRowIds.size`, only when N > 0. It must wrap
cleanly with the header's existing `flex-wrap` below `sm` (768px).

**Contract**: `checked={showAllRows}`, `onCheckedChange={setShowAllRows}`; absent when N = 0 (which
covers `hideEmptyRows` off, since the set is then empty).

#### 3. Muted revealed rows

**Files**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`, `src/styles/globals.css`

**Intent**: While `showAllRows` is on, add `kosztorys-revealed-row` to a row whose id is in
`clientEmptyRowIds`, and mute its cell text via a `.kosztorys-grid .dsg-row.kosztorys-revealed-row .dsg-cell`
rule using the muted-foreground token. Ordinals come from `documentRows` as today, so the revealed rows
are numbered in sequence with no extra code.

**Contract**: one class in `rowClassName`; one CSS rule next to the section-footer rules.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check: this phase is JSX + CSS over state Phase 1 already guards. Covered
  by the Whole-tree Gate.

#### Manual Verification:

- On `/k/<token>` with „Ukryj pozycje…" on, the header shows „Pokaż wszystkie pozycje (+N)" and N matches
  the count in the owner's „Inwestor" dialog.
- Switching it on shows the hidden pozycje in muted text, numbered in sequence; switching it off
  restores the curated list and numbering.
- Podsumowanie and section totals are identical with the switch on and off.
- A reload opens with the switch off.
- With „Ukryj pozycje…" off in the owner's dialog, no switch renders.
- The printed offer is unaffected by the switch.
- At phone width (<768px) the header wraps without clipping the switch label.

---

## Testing Strategy

### Unit Tests:

- `rowIdsMatching` in `queries.test.ts` (node).
- The switch's effect on `engagedConditionIds` in `use-kosztorys-view-state.test.tsx` (dom, `renderHook`).

### Manual Testing Steps:

1. Owner: „Inwestor" dialog → tick „Ukryj pozycje…", note the count, open „Podgląd dla inwestora".
2. Toggle the switch on/off; compare numbering, muted rows and Podsumowanie.
3. Reload; untick the setting and reload again; print the offer with the switch on.

## Performance Considerations

`rowIdsMatching` is one O(rows) pass, run only under preview with `hideEmptyRows` on, memoised on
`rows` — the client view never edits, so it runs once per load.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

## References

- `src/lib/kosztorys/row-conditions/queries.ts:228` — `clientConditionIds`
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:45`
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:378` — preview header

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: State and derivation

#### Automated

- [x] 1.1 View-state spec passes — 26e63959
- [x] 1.2 Queries spec passes — 26e63959

### Phase 2: Switch and muted rows

#### Automated

- [x] 2.1 No phase-scoped automated check (Whole-tree Gate covers it) — 766bf2ce
