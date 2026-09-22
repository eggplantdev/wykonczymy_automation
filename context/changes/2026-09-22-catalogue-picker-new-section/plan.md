# Nowa sekcja zakładana wprost w „Dodaj pracę z katalogu" — Implementation Plan

## Overview

The katalog picker's „Dodaj do:" only selects a sekcja that already exists. This change lets the owner
type a **new** sekcja name in the same control: the sekcja and the prace are written in one transaction
on „Dodaj", so „Anuluj" leaves nothing behind, and the new sekcja carries no blank first row.

## Current State Analysis

- `add-items-from-catalogue-dialog.tsx:257` renders a `SimpleSelect` keyed by `sectionId`; „Dodaj" is
  disabled until one is chosen (`:270`). There is no route from the dialog to a new sekcja.
- The workaround today: close the dialog → „Dodaj" → „Sekcja" (`addSectionAction`, which prepends a
  sekcja **plus a blank item** at display_order 0) → rename it in the grid → reopen the picker.
- The one exception is an empty kosztorys: `openPicker()` (`kosztorys-add-menu.tsx:37`) mints a sekcja
  through `handleAddSection()` first and hands it over preselected — i.e. the workaround, automated.
- `insertCatalogueItemsAction` (`lib/actions/work-catalogue.ts:140`) takes a `sectionId`, locks on
  `{ kind: 'section', id }`, re-reads every price from the cennik server-side and appends through
  `appendCatalogueItems` inside `withPayloadTransaction(… { skipRevalidation: true })`.
- `appendCatalogueItems` (`lib/kosztorys/work-catalogue/append-catalogue-items.ts:47`) resolves the
  owner via `sectionOwnerAndNextItemOrder` — so it structurally **requires a sekcja that already
  exists**, and returns the whole section slice the grid patches from.
- Grid patching is split by case already: `handleAppendedCatalogueItems`
  (`use-kosztorys-editor.ts:987`) folds rows into an existing band via `applyAddItem` + `unfoldSection`;
  `handleAddSection` (`:952`) **prepends** a new section row (`[row, ...rs]`), matching
  `addSectionAction`'s display_order 0; `handleAppendedSections` (`:965`) appends at the end, which is
  the preset path and the wrong placement here.
- `investmentAction` resolves the lock target either from an `investmentId` outright or through a row's
  parent — a create path therefore targets `{ investmentId }`, not `{ kind: 'section' }`.
- `ui/combobox.tsx` is the only control in the app with a „Dodaj „X"" create row (`allowCustom`,
  `CREATE_KEY` at `:26`), it is string-keyed, and `modal` exists precisely for use inside a Dialog
  (`:108`). `work-catalogue-item-form.tsx:83` is the reference call site, including the field-shaped
  class string.

### Key Discoveries:

- **Name is identity** (owner ruling, 2026-09-22, recorded in `change.md`) — which is what makes a
  string-keyed control legitimate here at all.
- The combobox's create row already compares case-insensitively (`combobox.tsx:56`), so typing
  „łazienka" against an existing „Łazienka" offers no create row. The server must enforce the same
  rule anyway: the dialog's list is a snapshot, and a sekcja can appear under it.
- `Combobox` keys its option buttons by the option string (`:141`), so the one duplicate-name pair in
  the dataset would produce duplicate React keys — the options list has to be deduped.
- `createSectionWithFirstItem` deliberately mints a blank item because a 0-item sekcja renders as 0
  rows. That reasoning does not hold here: the katalog prace are the rows, so a blank one would be a
  hole above them.
- `appendCatalogueItems` already carries everything the new path needs except the owner lookup
  (item mapping, the 65 % ceiling warnings, `insertItems`' distinct display_orders) — so this is an
  extraction, not a second implementation.

## What We're NOT Doing

- No uniqueness gate on the inline rename in the grid — it can still mint a twin.
- No repair of the one duplicate pair already in the dataset. **Amended in implementation**: the
  shipped `resolveSectionTarget` takes a third argument, `preferredSectionId` — the sekcja the picker
  was opened FROM wins over the name match while the name is still its own — so the second twin IS
  reachable when entered from one of its own rows. Typing the name plain still lands in the first.
- No reordering of the „Dodaj do:" control, no multi-section insert, no per-item section assignment.
- No change to how prices, stawki or the 65 % ceiling warning behave.
- No sekcja colour or etap seeded on the new sekcja (same reasoning as `createSectionWithFirstItem`).

## Implementation Approach

Two server entry points, one placement engine, one control.

The dialog stops carrying a `sectionId` and starts carrying a **name**. On „Dodaj" it resolves that
name against the sections it was handed: a hit calls the existing `insertCatalogueItemsAction`, a miss
calls a new `createSectionWithCatalogueItemsAction(investmentId, sectionName, ids)`. The resolution is
a pure function, so it is unit-testable without rendering anything, and the server repeats the same
check inside the transaction — the client's resolution is a convenience, not the gate.

The new sekcja lands at the **top** (display_order 0, shifting the rest), mirroring `addSectionAction`:
it is the same „mint a sekcja" gesture, and on a 1000-row kosztorys a sekcja appended at the end is a
write the owner has to go looking for.

## Critical Implementation Details

**State sequencing (server).** The sekcja create, the `shiftDisplayOrderFrom` that makes room for it
and the item inserts are one `withPayloadTransaction`, for the same reason `addSectionAction` wraps
its pair: a double-fired „Dodaj" would otherwise land two sekcje on display_order 0.

**Grid placement.** `handleAppendedSections` appends at the array's end and must NOT be reused — the
grid walks rows in order to build its bands, so a prepended sekcja whose rows sit at the end opens a
second band. The new handler prepends, exactly as `handleAddSection` does.

---

## Phase 1: Server — sekcja and prace in one transaction

### Overview

Split the placement of katalog prace away from the „sekcja already exists" lookup, then build the
create path on top of it, including the name-collision fallback.

### Changes Required:

#### 1. Extract the placement engine

**File**: `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts` (new)

**Intent**: Lift the part of `appendCatalogueItems` that maps cennik rows into pozycje, collects the
65 % ceiling warnings and writes them, so the create path reuses it instead of restating it. Its own
file per the one-concern rule; `append-catalogue-items.ts` keeps only the owner lookup.

**Contract**: takes the resolved owner (`investmentId`, the `KosztorysSectionT`, the first
`displayOrder`) plus the cennik rows, and returns `AppendedCatalogueSliceT`. `appendCatalogueItems`
becomes: resolve owner → delegate.

#### 2. Create the sekcja with its prace

**File**: `src/lib/kosztorys/work-catalogue/create-section-with-catalogue-items.ts` (new)

**Intent**: Mint a sekcja at display_order 0 with the given name and fill it with the katalog prace —
**no blank first item**. If a sekcja with that name already exists in this investment, append into it
instead of minting a twin (the owner's name-is-identity rule, enforced where it can actually be
enforced).

**Contract**: `(payload, req, { investmentId, sectionName, catalogueItems }) =>
NewSectionCatalogueSliceT`. The name is trimmed; the existing-name lookup is case-insensitive over
this investment's sekcje. Caller owns the transaction, same as `appendCatalogueItems`. Items start at
`displayOrder 0` on a fresh sekcja and at `MAX+1` on the fallback (reuse `appendCatalogueItems` for
the fallback branch rather than re-deriving it).

#### 3. The result type

**File**: `src/lib/kosztorys/work-catalogue/types.ts`

**Intent**: The client has to know whether a sekcja was actually created, because the collision
fallback means asking for one is not the same as getting one — and the two cases patch the grid
differently.

**Contract**: `export type NewSectionCatalogueSliceT = AppendedCatalogueSliceT & { createdSection: boolean }`.

#### 4. The action

**File**: `src/lib/actions/work-catalogue.ts`

**Intent**: A second entry point beside `insertCatalogueItemsAction` for the create case. Separate
action rather than a union target, mirroring `addSectionAction` / `insertSectionAction`: the lock
target genuinely differs (`{ investmentId }` vs `{ kind: 'section', id }`) and each validates only
what it takes.

**Contract**: `createSectionWithCatalogueItemsAction(investmentId: number, sectionName: string,
catalogueItemIds: number[]): Promise<ActionResultT<NewSectionCatalogueSliceT>>`. Zod: positive int
id, `sectionName` trimmed and non-empty, ≥1 catalogue id. Same id de-duplication and
„part of these prace no longer exist" refusal as the sibling action — extract that pre-flight
(dedupe → `listCatalogueItemsByIds` → length check) so both actions share it. Revalidates
`['kosztorysSections', 'kosztorysItems']`.

### Success Criteria:

#### Automated Verification:

- A second `describe` in `src/__tests__/lib/actions/work-catalogue-insert.test.ts` covers the create
  path against the real DB — sekcja written with the typed name at display_order 0, prace as its only
  rows (no blank item), an existing name appending into that sekcja with `createdSection: false`, and
  a failed insert leaving no orphan sekcja behind.
- That spec passes against the isolated test DB:
  `docker compose up -d --wait db-test && set -a && . ./.env && set +a && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-insert.test.ts`
- The existing cases in that file still pass unchanged (the extraction is behaviour-preserving).

#### Manual Verification:

- None at this phase — nothing on screen reaches the new action yet.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
**not** pause for per-phase manual confirmation.

---

## Phase 2: The „Dodaj do:" control

### Overview

Swap the id-keyed select for the name-keyed combobox and route „Dodaj" to one of the two actions.

### Changes Required:

#### 1. Name → target resolution

**File**: `src/lib/kosztorys/work-catalogue/section-target.ts` (new)

**Intent**: Decide, from a typed name and the sekcje the dialog was handed, whether „Dodaj" means an
existing sekcja or a new one. React-free so it is testable without rendering, per the cheapest-layer
rule.

**Contract**: `sectionNameOptions(sections)` → unique names in the sections' own order (the dedupe the
combobox's `key={option}` needs); `resolveSectionTarget(name, sections, preferredSectionId?)` →
`{ kind: 'existing'; sectionId } | { kind: 'new'; name } | undefined`, matching trimmed and
case-insensitively, `undefined` for a blank name. (Shipped with `undefined` rather than the `null`
drafted here — the repo's TS rule — and with the third argument added; see „What We're NOT Doing".)

#### 2. The dialog

**File**: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`

**Intent**: „Dodaj do:" becomes a `Combobox` with `allowCustom` + `modal`, holding a **name**; the
state changes from `sectionId: number | null` to `sectionName: string`, seeded from
`initialSectionId`'s name. `handleConfirm` resolves the name and calls the matching action; everything
downstream (toasts, warning cap, close) is unchanged except that `onInserted` now also reports whether
a sekcja was created.

**Contract**: `PropsT` gains `investmentId: number`; `onInserted: (slice: AppendedCatalogueSliceT['section'], createdSection: boolean) => void`.
„Dodaj" is enabled on a non-empty trimmed name + ≥1 praca. Styling follows
`work-catalogue-item-form.tsx:83` (`border-input bg-background h-9 rounded-md border px-3`, width
kept at `w-56`, `contentClassName="w-(--radix-popover-trigger-width)"`).

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts` (node) covers: exact name → the
  existing id; different case / surrounding whitespace → the same existing id, never a create; an
  unknown name → `{ kind: 'new' }`; a blank name → `null`; duplicate names deduped to one option.
- `src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx` (dom,
  actions mocked) covers: a typed new name calls the create action with that name and never the insert
  action; picking a listed sekcja calls the insert action with its id; „Dodaj" stays disabled while the
  name is blank.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx`

#### Manual Verification:

- Typing a name that is not on the list offers „Dodaj „X"" and, after „Dodaj", the prace land in a new
  sekcja at the top of the rozpiska with no blank row above them.
- Typing an existing name in a different case lands the prace in that sekcja — no second sekcja of the
  same name appears.
- „Anuluj" after typing a new name leaves no sekcja behind, on screen and after a refresh.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Grid patch and the empty-kosztorys path

### Overview

Land the created sekcja in the grid at the top, and drop the pre-mint workaround the picker no longer
needs.

### Changes Required:

#### 1. The new-sekcja patch

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: A created sekcja arrives as a whole slice and must be **prepended** — `applyAddItem` has no
band to fold into, and `handleAppendedSections` would park it at the end and split the band. The three
slice-to-rows call sites now spell out the same nine `treeToRows` arguments, so fold that into one
local helper while adding the third.

**Contract**: shipped as ONE handler instead of the second one drafted here —
`handleAppendedCatalogueItems(slice, createdSection)` branches internally through
`catalogueSlicePlacement` (`lib/kosztorys/row-ops.ts`), which returns `prepend` / `fold` / `reseed`.
One context export, one `rowsFromSections` call, and the third case — the server appended into a
sekcja this grid holds no row for — has nowhere to hide.

#### 2. Host routing

**File**: `src/components/kosztorys/editor/actions/catalogue-picker-host.tsx`

**Intent**: Pass `investmentId` down and pick the patch by what the server reports.

**Contract**: `onInserted={handleAppendedCatalogueItems}` — the branch moved into the handler (see
above), so the host only passes `investmentId` down and hands the callback straight through.

#### 3. Drop the pre-mint

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`

**Intent**: `openPicker()` exists only because the picker needed a sekcja to land in — it mints
„Nowa sekcja" **with a blank row**, which is the very workaround this change removes. The menu item
opens the picker directly now, on an empty kosztorys too, and the comment explaining the pre-mint goes
with it.

**Contract**: `Praca z katalogu…` calls `openCataloguePicker()` unconditionally; `openPicker` and its
`handleAddSection` dependency disappear from this component.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check — this phase is grid placement and wiring, whose signal is visual and
  is covered by the manual checks below plus the whole-tree gate. (Stated deliberately rather than
  padded with a repo-wide command.)

#### Manual Verification:

- On an empty kosztorys, „Dodaj → Praca z katalogu…" opens the picker straight away, with no sekcja
  minted up front; typing a name and adding creates the sekcja with the prace and nothing else.
- The created sekcja appears at the top of the rozpiska, unfolded, its band intact (not split in two),
  and survives a page refresh in that position.
- The same flow works in the szablon warsztat (`/szablony/[id]`), and the szablon mirror picks the new
  sekcja up.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `resolveSectionTarget` / `sectionNameOptions` — case, whitespace, unknown name, blank, duplicates.

### Integration Tests:

- `createSectionWithCatalogueItemsAction` against the 5435 test DB: rows persisted (not the return
  value), display_order 0, no blank item, the name-collision fallback, and no orphan sekcja on failure.

### Component Tests:

- The dialog routes „Dodaj" to the right action for a typed vs picked name, and gates on a blank name.

### Manual Testing Steps:

1. Kosztorys with sekcje → picker → tick two prace → type a new name → „Dodaj" → sekcja at the top,
   two rows, no blank row.
2. Repeat with an existing name typed in a different case → no twin sekcja.
3. Tick prace, type a new name, „Anuluj", refresh → no sekcja.
4. Empty kosztorys → „Dodaj → Praca z katalogu…" → sekcja created only on „Dodaj".
5. `/szablony/[id]` → same flow → szablon mirror updated.

## Performance Considerations

The create path costs one extra query (the name lookup) on a route the owner takes by hand — nothing
here runs per row or per keystroke. The picker's own render cost is untouched: the control swap keeps
state inside the dialog, which is mounted only while open.

## Migration Notes

None — no schema change, and both actions write through the existing collections.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change record: `context/changes/2026-09-22-catalogue-picker-new-section/change.md`
- Placement precedent: `src/lib/actions/kosztorys.ts:327` (`addSectionAction`)
- Control precedent: `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:83`
- Grid patch precedents: `src/components/kosztorys/editor/use-kosztorys-editor.ts:952`, `:987`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server — sekcja and prace in one transaction

#### Automated

- [x] 1.1 Create-path DB cases added to `work-catalogue-insert.test.ts`
- [x] 1.2 That spec passes against the 5435 test DB
- [x] 1.3 The pre-existing cases in that file still pass

### Phase 2: The „Dodaj do:" control

#### Automated

- [x] 2.1 `section-target.test.ts` covers case/whitespace/unknown/blank/duplicates
- [x] 2.2 Dialog dom spec covers typed-name vs picked-name routing and the blank-name gate
- [x] 2.3 Both specs pass in one `vitest run`

### Phase 3: Grid patch and the empty-kosztorys path

#### Automated

- [ ] 3.1 (none — placement and wiring, verified manually and by the whole-tree gate)
