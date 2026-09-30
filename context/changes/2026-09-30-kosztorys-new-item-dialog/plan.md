# Add a praca through a form dialog — Implementation Plan

## Overview

Every way of adding a praca in the kosztorys editor (row menu „Wstaw powyżej/poniżej”, sekcja band and sekcja menu „Dodaj pracę”, toolbar „Dodaj → Praca”) opens a form dialog instead of minting a blank „Nowa praca” row.

- **Fields:** opis, j.m., Cena j.m., and the two stawka źródła.
- **Placement:** the praca lands at the chosen spot.
- **Katalog:** an optional „Dodaj pracę do katalogu prac” checkbox writes the katalog entry in the same transaction.
- **Blank-row path:** removed. Linear: EX-951.

## Current State Analysis

- **Client entry points.** All five funnel into two callbacks in `use-kosztorys-editor.ts`: `handleAddItem(sectionId)` (:838) and `handleInsertItem(anchorRow, dir)` (:863).
  - They reach the menus and cells as `onAddItem` / `onInsertItem` through `editorOnly` (:553, :578). The read-only gate comes for free.
  - The toolbar's zero-sekcje branch calls `handleAddSection()` and then `handleAddItem(id)`.
- **Server.**
  - `addItemAction` (`lib/actions/kosztorys.ts:426`) and `insertItemAction` (:452) create a blank row through `createBlankItem` (`lib/kosztorys/create-item.ts:48`), which takes no fields.
  - The client mirrors that row with `buildBlankRow` (`row-ops.ts:38`).
- **What already exists to build on:**
  - `insertItems` (raw SQL, takes full `KosztorysItemT`s).
  - `catalogueEntryAsItem` (rate → override columns).
  - `placeCatalogueItems` (ceiling warnings).
  - `resolveInsertSlot` + `shiftDisplayOrderFrom` (insert-at under a section lock).
  - `rowsFromSections` (server items → grid rows with current stages and globals).
- **Katalog.** Identity is `catalogueKey(opis, j.m.)`, which is pure and usable client-side. The editor already holds `workCatalogue` in context.
  - The katalog write logic (`toRow`, duplicate pre-check, overwrite-keeps-kategoria) lives inside the `'use server'` file `lib/actions/work-catalogue.ts`, so another action cannot import it.
- **Form.** `WorkCatalogueItemForm` is bound to a katalog-only store and values type, and has three consumers. Its `RateField`, `rateColumns` and schema pieces are private.
- **Dialog host.** Menus unmount on close, so a dialog must be hosted once. `CataloguePickerHost` is the pattern. It is rendered **inside** `KosztorysEditorBody`, below the place where the body builds `onAddItem` / `onInsertItem` into the band bundle and the column opts.

Full findings: `research.md`.

## Desired End State

- **Any of the five entry points** opens a „Nowa praca” dialog titled with where the praca will land. It has opis, j.m., Cena j.m., two stawka źródła, and the checkbox „Dodaj pracę do katalogu prac”.
- **Checkbox on:** a Kategoria field appears, prefilled with the sekcja name minus its trailing number.
- **„Dodaj”:**
  - The praca appears at the chosen spot without a reload.
  - A collapsed sekcja unfolds.
  - A stawka podwykonawcy above the 65% ceiling toasts a warning.
- **Katalog collision** (checkbox on, same opis + j.m. already in the katalog): a confirm shows old → new figures, with three buttons: „Nadpisz w katalogu” / „Tylko do kosztorysu” / „Wróć”.
  - Escape and overlay click = „Wróć”.
  - When the kategorie differ, a „Zostaw kategorię z katalogu” checkbox (default on) appears.
- **„Nie zamykaj po zapisaniu”:**
  - The form resets to its opening state (checkbox off, kategoria = sekcja name).
  - The next praca lands under the one just saved. If the dialog was opened for the end of a sekcja, it lands at the end of that sekcja.
- **Toolbar with no sekcje:** a sekcja is created first, then the dialog opens for it.
- **Removed:** nothing in the app creates a „Nowa praca” blank row any more. `addItemAction(sectionId)`, `insertItemAction`, `createBlankItem`, `buildBlankRow`, `makeBlankRow` and `DEFAULT_ITEM_DESCRIPTION` are gone.

### Key Discoveries:

- `withPayloadTransaction` commits when `work` **returns** (even `{success: false}`) and rolls back only on a **throw** (`lib/db/with-payload-transaction.ts:23-40`). Any refusal must happen before the first write.
- `use-form-submit.ts:28-51`: the awaited path (`keepOpen || awaitBeforeClose`) already toasts `result.warning`. Ceiling warnings therefore ride on `ActionResultT.warning` with no new UI.
- `useManagedForm`'s `confirmBeforeSubmit` answers a boolean, and "no" aborts (`use-managed-form.ts:125-131`). `ConfirmDialog` fires `onCancel` on Escape/overlay (`ui/confirm-dialog.tsx:24-26`). Neither can express "save, but not to the katalog".
- `optimistic-form-store.ts:53-57`: `closeDialog` never resets `showKeepOpen`, so it leaks into later raw-`Dialog` forms.
- `section-category.ts`: `stripSectionOrdinal` is the shared sekcja → kategoria rule.
- `lessons.md:1183`: a hidden field still ships, so Kategoria must be stripped in `toData` when the checkbox is off.

## What We're NOT Doing

- Przedmiar in the dialog (owner: no).
- Putting the add on the undo stack (it is not there today).
- Touching `extraAsItem` in `lib/actions/worker-report.ts`, even though it duplicates the item builder. That file is in flight in another session (EX-947); dedup it once that lands.
- Changing the katalog picker, the „Zapisz pozycję do katalogu prac” flow, or the katalog page form (beyond the shared-module extraction, which leaves their behaviour unchanged).
- Gating „Dodaj pracę” under a sort. It stays ungated, as reviewed in kosztorys-empty-section.
- Remembering the checkbox state across opens (owner: always starts off).

## Implementation Approach

1. **Server first:** one action with a placement union replaces both blank-row actions and optionally writes the katalog in the same transaction. The katalog write helpers move out of the `'use server'` file so both this action and `saveItemToCatalogueAction` use one implementation.
2. **Form:** extract the stawka-plane pieces into a shared module and compose a new form. Add a small `beforeSubmit` hook to `useManagedForm` for the three-outcome collision confirm.
3. **Editor wiring:** keep `handleAddItem` / `handleInsertItem` as the seam so no menu, cell or column-opts code changes.
   - Their bodies now open the dialog through a stable ref the host registers into.
   - A new `placeNewItem` puts the server-returned item into the grid.
   - Then delete the blank-row path.

## Critical Implementation Details

- **Transaction ordering:** in the action, resolve the katalog decision (find by `matchKey` with `req`) **before** `insertItems`.
  - A `'new'` request that meets an existing entry must return the Polish duplicate error while nothing has been written yet, because a returned failure still commits.
  - A 23505 from a race throws, and that rolls back the item as well.
- **Host placement:** the host sits under the body, but the openers are built above it. Bridge them through a stable `useRef` the editor hook owns and the host assigns in an effect. Do not put state in the editor hook: a target in hook state re-renders the grid on every open (EX-496).
- **Keep-open chain:** the placement lives in a ref inside the dialog, and the action closure advances it after a success.
  - `{kind: 'end'}` stays `end`. That is always correct, even under a column sort.
  - `{kind: 'next-to'}` becomes `{kind: 'next-to', anchorItemId: <new id>, dir: 'below'}`.

## Phase 1: Server — one action that creates a filled praca, optionally writing the katalog

### Overview

A new `addItemAction(input)` replaces `addItemAction(sectionId)` and `insertItemAction`. It creates a praca with the typed fields at the placement and, on request, creates or overwrites the katalog entry in the same transaction.

### Changes Required:

#### 1. Item builder shared by the katalog placement and the new action

**File**: `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts` (or a sibling `src/lib/kosztorys/item-from-fields.ts`)

**Intent**: One function builds a `KosztorysItemT` from opis / j.m. / cena / rate columns at a section slot. `catalogueEntryAsItem` becomes a call to it. Also extract the per-item ceiling-warning mapping, so the new action and `placeCatalogueItems` phrase warnings identically.

**Contract**:
- `itemFromFields(fields: {description, unit, clientPrice, wToolsRate, wToolsRateCoeff, ownToolsRate, ownToolsRateCoeff}, sectionId, displayOrder): KosztorysItemT`, with `plannedQty: 0`, `discountValue: 0` and `note: null`.
- `ceilingWarnings(items: KosztorysItemT[]): string[]`.

#### 2. Katalog write helpers out of the `'use server'` file

**File**: `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts` (new, `server-only`), `src/lib/actions/work-catalogue.ts`

**Intent**:
- Move `toRow`, `DUPLICATE_ERROR` and the find-by-`matchKey` lookup into the new module.
- Add `resolveCatalogueWrite` (read-only) and `applyCatalogueWrite` (the write). Every Payload call takes an optional `req`, so they join a caller's transaction.
- Refactor `createCatalogueItemAction`, `updateCatalogueItemAction` and `saveItemToCatalogueAction` onto them. There is exactly one "overwrite keeps the katalog's kategoria unless told otherwise" implementation.

**Contract**:
- The mode is `'new' | 'overwrite'`, plus `keepCatalogueCategory` (default `true`).
- `'overwrite'` with no existing entry is a create (the existing race semantics). `'new'` against an existing entry is `DUPLICATE_ERROR`.
- The lookup is separate from the write so the caller can refuse before its first write.

#### 3. The action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Replace `addItemAction(sectionId)` and `insertItemAction` with `addItemAction(input)`, all inside one `withPayloadTransaction(…, {skipRevalidation: true})`. Steps:

1. Validate.
2. Resolve the katalog decision if one was requested; refuse on duplicate.
3. Resolve the slot:
   - `end`: `sectionOwnerAndNextItemOrder` with the tx db;
   - `next-to`: `resolveInsertSlot` → `investmentGateForRow` → `shiftDisplayOrderFrom`.
4. Build the item and `insertItems`.
5. Apply the katalog write with `req`.

Return the persisted item and join ceiling warnings into `warning`. Revalidate `['kosztorysItems', 'workCatalogue']`, plus `'workCatalogue'` only when a katalog write happened. Trim opis and j.m. as cell edits do.

**Contract**:

```ts
addItemAction(input: {
  placement: { kind: 'end'; sectionId: number } | { kind: 'next-to'; anchorItemId: number; dir: InsertDirectionT }
  data: WorkCatalogueItemDataT            // reused domain schema: min(0) on money/coeff, not both columns per plane
  catalogue: null | { mode: 'new' | 'overwrite'; keepCatalogueCategory: boolean }
}): Promise<ActionResultT<{ item: KosztorysItemT }>>
```

- The gate target is `{kind: 'section', id}` for `end` and `{kind: 'item', id: anchorItemId}` for `next-to` (investment lock).
- `data.category` is read only when `catalogue !== null`.
- `insertItems` bypasses Payload's field rules, so the Zod schema is the only backstop for negatives and double-set planes.

#### 4. Tests and fixtures retargeted to the new signature

**Files**:
- `src/__tests__/lib/actions/kosztorys-add-item.test.ts` (new)
- `kosztorys-lock.test.ts`
- `kosztorys-create-order.test.ts`
- `kosztorys-renumber-kosztorys-order.test.ts`
- `src/__tests__/lib/kosztorys/display-order.test.ts`
- `work-catalogue.test.ts`
- `work-catalogue-save.test.ts`

**Intent**:
- The new DB spec, anchored on test-plan risks #6 and #17, asserts **persisted rows**, not return values:
  - `end` appends past MAX with every typed field stored;
  - „auto” leaves both override columns null, a kwota sets the value, and a mnożnik sets the coeff;
  - `next-to` above and below shifts the tail;
  - katalog `'new'` creates the entry with `matchKey` and kategoria;
  - `'new'` against an existing entry is refused **with no item written**;
  - `'overwrite'` updates in place (same id and `created_at`) and keeps the kategoria by default, and `keepCatalogueCategory: false` writes the new one;
  - a katalog write that throws after the insert rolls back the item (a `failNext` mock, as in `catalogue-to-kosztorys.test.ts`);
  - a negative price or both columns of one plane are refused;
  - a >65% stawka returns a `warning`.
- The specs that used the old `addItemAction(sectionId)` as a fixture move to a small shared helper that calls the new action with fixed fields. Add both placements to the lock matrix, in place of the two old rows.
- The two katalog specs must stay green on the refactored helpers.

### Success Criteria:

#### Automated Verification:

- New action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-add-item.test.ts`
- Retargeted specs pass: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-lock.test.ts src/__tests__/lib/actions/kosztorys-create-order.test.ts src/__tests__/lib/actions/kosztorys-renumber-kosztorys-order.test.ts src/__tests__/lib/kosztorys/display-order.test.ts`
- Katalog specs still pass on the extracted helpers: `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue.test.ts src/__tests__/lib/actions/work-catalogue-save.test.ts src/__tests__/lib/actions/catalogue-to-kosztorys.test.ts`

#### Manual Verification:

- (covered at the end of Phase 3)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: The „Nowa praca” form and its collision confirm

### Overview

A new form, built from the katalog form's extracted stawka pieces, with the checkbox, the conditional Kategoria, and a three-outcome collision confirm.

### Changes Required:

#### 1. Shared stawka-plane pieces

**File**: `src/components/forms/work-catalogue-item/rate-fields.tsx` (new), `work-catalogue-item-schema.ts`, `work-catalogue-item-form.tsx`

**Intent**: Move `RateField`, `rateColumns`, `PLANE_LABEL` and the plane types out of the katalog form. Export `baseSchema` and the plane refinement as a reusable function, so a second form composes them without copying. The katalog form imports them back, with unchanged behaviour.

**Contract**:
- `RateField({form, plane, sourceLabels})`. The „auto” option wording is a prop, because the katalog says "ze współczynnika inwestycji, do której praca trafi" while the editor can say „ze współczynnika tej inwestycji”.
- `refineRatePlanes(value, ctx)`.
- `rateColumns(plane, value)`.

#### 2. `beforeSubmit` on `useManagedForm`

**File**: `src/components/forms/hooks/use-managed-form.ts`

**Intent**: An optional async gate between a valid form and the write. Resolving `false` returns to the form with nothing sent. It sits beside `confirmBeforeSubmit`, which stays as is for its existing callers.

**Contract**: `beforeSubmit?: (values: TValues) => Promise<boolean>`, awaited after `confirmBeforeSubmit` and before `submit`.

#### 3. `showKeepOpen` reset

**File**: `src/stores/optimistic-form-store.ts`

**Intent**: `closeDialog` also sets `showKeepOpen: false`, so a raw-`Dialog` form opened after a `FormDialog` no longer shows a dead „Nie zamykaj po zapisaniu”.

**Contract**: `openDialog` still sets it on every open, so `FormDialog` behaviour is unchanged.

#### 4. The form and dialog

**Files**:
- `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx`
- `new-item-form-schema.ts`
- `new-item-dialog.tsx`
- `catalogue-collision-confirm.tsx`
- `src/stores/form-stores.ts` (a store entry; `useManagedForm` requires one even with `persistDraft={false}`)

**Intent**:
- **Values:** the katalog form's values plus `addToCatalogue: boolean`.
  - Defaults: opis empty, j.m. empty, cena empty, both źródła `auto`, checkbox off, kategoria = `stripSectionOrdinal(sectionName)`.
- **Kategoria** renders only while the checkbox is on. `toData` sends `catalogue: null` and ignores kategoria when it is off.
- **j.m. options:** `unitOptions(units already in this kosztorys, current)` from `lib/kosztorys/worker-report/unit-options.ts`.
- **Collision:** `beforeSubmit` checks `catalogueKey(opis, j.m.)` against `workCatalogue[].matchKey`. On a hit it opens the collision confirm and awaits the choice, which a ref holds for `toData`:
  - „Nadpisz w katalogu” → `{mode: 'overwrite', keepCatalogueCategory}`;
  - „Tylko do kosztorysu” → `catalogue: null`;
  - „Wróć” / Escape / overlay → `false`.
- **The confirm** is built on `AlertDialog` directly, not `ConfirmDialog` (which has two buttons and cancel-on-escape). It shows katalog vs new figures with the `PriceList` and the overwrite sentence, both extracted from `save-item-to-catalogue-dialog.tsx` into a shared file under `dialogs/catalogue/`, and „Zostaw kategorię z katalogu” when the kategorie differ.
- **The dialog:**
  - calls `openDialog(formId, true)` on mount and `closeDialog` on unmount;
  - reads `keepOpen` from the store;
  - uses `persistDraft={false}`, so the awaited path returns the created item before close;
  - its `action` closure calls `addItemAction`, hands the item to `onPlaced(item, placement)`, then advances the placement ref (see Critical Implementation Details).
- **Title:** „Nowa praca”, with a description naming the landing spot: „na końcu sekcji „…”” or „pod / nad „<opis kotwicy>””.

**Contract**:
- `NewItemDialog({ placement, sectionName, anchorDescription?, workCatalogue, kosztorysUnits, onPlaced, onClose })`.
- `onPlaced(item: KosztorysItemT, placement: NewItemPlacementT)`.
- `NewItemPlacementT` is the same union the action takes.

#### 5. DOM specs

**Files**:
- `src/__tests__/components/kosztorys/editor/dialogs/new-item/new-item-form.test.tsx` (new)
- `src/__tests__/components/forms/hooks/use-managed-form.test.tsx`
- `src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-form.test.tsx`

**Intent**:
- **Form spec** (action mocked):
  - Kategoria is hidden until the checkbox, prefilled without the sekcja ordinal;
  - checkbox off sends `catalogue: null` even after kategoria was typed;
  - „auto” sends null columns;
  - on a collision, „Wróć” and Escape call no action, „Tylko do kosztorysu” sends `catalogue: null`, and „Nadpisz” sends `overwrite` with keep-category `true` by default;
  - with keep-open, after a save the form is back at its defaults and the second call's placement is `next-to` below the first returned id, while an `end` placement stays `end`.
- **Hook spec:** `beforeSubmit` resolving `false` sends nothing.
- **Katalog form spec:** stays green after the extraction.

### Success Criteria:

#### Automated Verification:

- Form spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/new-item/new-item-form.test.tsx`
- Hook spec passes: `pnpm exec vitest run src/__tests__/components/forms/hooks/use-managed-form.test.tsx`
- Katalog form spec unchanged-green: `pnpm exec vitest run src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-form.test.tsx`

#### Manual Verification:

- (covered at the end of Phase 3)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Editor wiring and removal of the blank-row path

### Overview

Route the five entry points to the dialog, land the saved praca in the grid, and delete everything that minted a blank row.

### Changes Required:

#### 1. Host

**File**: `src/components/kosztorys/editor/actions/new-item-host.tsx` (new), `kosztorys-editor-body.tsx`

**Intent**: A `NewItemHost` beside `CataloguePickerHost`, with the same `children`-as-prop trick.
- It holds `target: {placement} | null` and registers a stable `open(placement)` into the editor hook's ref in an effect, cleared on unmount.
- It resolves the sekcja name, the anchor's opis and the kosztorys units from context at render time. That covers the toolbar's just-created sekcja, which reaches context one render after `handleAddSection`.
- It mounts `NewItemDialog` only while a target is set.

**Contract**: `editor.newItemDialogRef: RefObject<((placement: NewItemPlacementT) => void) | null>`. It is a stable ref object in the context value, so there is no identity churn.

#### 2. Editor hook

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**:
- `handleAddItem(sectionId)` opens `{kind: 'end', sectionId}` through the ref. `handleInsertItem(row, dir)` keeps its `orderCommandsEnabled(sort)` guard and opens `{kind: 'next-to', anchorItemId: row.id, dir}`.
- New `placeNewItem(item, placement)`:
  - builds the row through `rowsFromSections` (section slice from `sectionMeta`);
  - `end` → `applyAddItem` with the `orderRowsBySections` re-lay for a first pozycja (the current `handleAddItem` logic);
  - `next-to` → `applyInsertItem`;
  - then `unfoldSection` in both cases.
- Delete `makeBlankRow` and the two action imports.

**Contract**: The names and signatures of `onAddItem`, `onInsertItem` and `handleAddItem` are unchanged. The toolbar's zero-sekcje branch keeps working with no edit.

#### 3. Dead code

**Files**:
- `src/lib/kosztorys/create-item.ts` (`createBlankItem`, `NewRowT` if unused)
- `src/lib/kosztorys/row-ops.ts` (`buildBlankRow`, `BlankRowInputT`)
- `src/lib/kosztorys/constants.ts` (`DEFAULT_ITEM_DESCRIPTION` and its comment)
- `src/__tests__/lib/kosztorys/row-ops.test.ts` (its `buildBlankRow` cases)

**Intent**: Remove the blank-row path. Gate the deletion on typecheck, not grep.

#### 4. Hook and menu specs

**Files**:
- `src/__tests__/components/kosztorys/editor/use-kosztorys-itemless-sections.test.tsx`
- `use-kosztorys-catalogue-problems.test.tsx`
- `toolbar/kosztorys-editor-toolbar.test.tsx`
- `toolbar/menus/kosztorys-add-menu.test.tsx`

**Intent**:
- The itemless-sections spec keeps its assertion that a first pozycja lands under its own band, now driven through `placeNewItem`.
- The mocks drop the deleted actions.
- The toolbar specs wrap in `NewItemHost` as they do in `CataloguePickerHost`.

#### 5. E2E spec rewritten

**File**: `e2e/kosztorys-structure.spec.ts` (:138-196, :277-304, :307-345)

**Intent**: Where the spec expected a blank „Nowa praca” row, it now fills the dialog with a fabricated opis and saves, then asserts the row by that opis. Add one flow that saves with the checkbox on and sees the entry on the katalog page.

**Contract**: Authoring only. Run it when the user asks: E2E is never run unprompted.

#### 6. Docs

**File**: `context/reference/kosztorys-editor-domain-notes.md` (and any passage describing the blank row)

**Intent**: Replace any description of the blank „Nowa praca” row with the dialog, its placement rules and the katalog checkbox. Record the three-outcome collision and why „Tylko do kosztorysu” exists (the owner's ruling from 2026-09-30).

### Success Criteria:

#### Automated Verification:

- Editor hook specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/use-kosztorys-itemless-sections.test.tsx src/__tests__/components/kosztorys/editor/use-kosztorys-catalogue-problems.test.tsx`
- Toolbar and menu specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar`
- Row-ops spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-ops.test.ts`
- No blank-row symbol survives: `grep -rn "DEFAULT_ITEM_DESCRIPTION\|createBlankItem\|buildBlankRow\|insertItemAction" src e2e` returns nothing

#### Manual Verification:

- Row menu „Wstaw powyżej” / „Wstaw poniżej” opens „Nowa praca”, and the saved praca lands directly above / below that praca without F5.
- The band „+ Dodaj pracę” on an empty sekcja and the sekcja ⋯ „Dodaj pracę” land the praca at the end of that sekcja. A collapsed sekcja unfolds.
- Toolbar „Dodaj → Praca → [sekcja]” lands at the end of that sekcja. On a kosztorys with no sekcje, a sekcja appears first and the dialog opens for it.
- Stawki: „auto” prices from the investment współczynnik, a kwota stała shows as the typed kwota, and a mnożnik prices off the Cena j.m.
- A stawka podwykonawcy above the ceiling saves and shows a warning toast.
- Checkbox on with a new opis + j.m.: the entry appears in „Katalog prac” with the typed kategoria.
- Checkbox on with an existing opis + j.m.:
  - the confirm shows old → new;
  - „Wróć” and Escape return to the form with nothing saved;
  - „Tylko do kosztorysu” saves the praca and leaves the katalog unchanged;
  - „Nadpisz w katalogu” updates the entry in place and keeps its kategoria unless the checkbox is cleared.
- „Nie zamykaj po zapisaniu”: after a save the form is empty again, and a second praca lands under the first.
- „Wstaw powyżej/poniżej” is still disabled under a column sort. „Dodaj pracę” under a sort appends at the end of the sekcja.
- On a completed (locked) investment and in the client preview, no add entry point is offered.
- In a szablon, the „Akcje” entry points open the same dialog, and the katalog checkbox works.
- After opening and closing „Nowa praca”, a „Dodaj …” dialog elsewhere shows „Nie zamykaj po zapisaniu” as before, and a raw dialog shows no stray checkbox.

**Implementation Note**: When this phase's automated verification passes, commit, then run the Whole-tree Gate.

---

## Testing Strategy

### Unit / DOM Tests:

- **Form behaviour** (Phase 2): kategoria visibility and stripping, collision outcomes, keep-open reset and placement chaining.
- **`useManagedForm.beforeSubmit`**: false sends nothing.
- **Editor**: a first pozycja in an itemless sekcja lands under its own band.

### Integration Tests (DB, 5435):

- The new action: placements, stored fields per stawka źródło, katalog `new` / `overwrite` / duplicate refusal with no item written, rollback when the katalog write throws, lock gate, negative refusal, ceiling warning.
- Retargeted display-order, create-order, renumber and lock specs.

### E2E:

- `e2e/kosztorys-structure.spec.ts` rewritten for the dialog, plus one katalog-checkbox flow. It runs on request only.

### Manual Testing Steps:

See Phase 3 Manual Verification.

## Performance Considerations

Opening the dialog must not re-render the grid. The host owns the target state and receives the body as `children`, and the editor hook exposes only a stable ref (EX-496).

## Migration Notes

None. No schema change; the katalog and kosztorys tables are written as they are today.

## Whole-tree Gate

Run once, after Phase 3:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration`
- Unit + DOM suite passes: `pnpm test` (run only when the user asks. Memory rule: no full suite unasked. Otherwise the touched specs above stand in.)

## References

- Research: `context/changes/2026-09-30-kosztorys-new-item-dialog/research.md`
- Host pattern: `src/components/kosztorys/editor/actions/catalogue-picker-host.tsx`
- Katalog placement and warnings: `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts`
- Overwrite UX to mirror: `src/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog.tsx`
- Insert-at under lock: `src/lib/actions/kosztorys.ts:452-492`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server — one action that creates a filled praca, optionally writing the katalog

#### Automated

- [x] 1.1 New action spec passes
- [x] 1.2 Retargeted specs pass
- [x] 1.3 Katalog specs still pass on the extracted helpers

### Phase 2: The „Nowa praca” form and its collision confirm

#### Automated

- [ ] 2.1 Form spec passes
- [ ] 2.2 Hook spec passes
- [ ] 2.3 Katalog form spec unchanged-green

### Phase 3: Editor wiring and removal of the blank-row path

#### Automated

- [ ] 3.1 Editor hook specs pass
- [ ] 3.2 Toolbar and menu specs pass
- [ ] 3.3 Row-ops spec passes
- [ ] 3.4 No blank-row symbol survives
