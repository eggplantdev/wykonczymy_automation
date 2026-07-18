# Stable per-row ids for expense line-items — Implementation Plan

## Overview

Expense line-item rows are identified by their position in the `lineItems` array. Three pieces
of out-of-form state — the invoice file map, the AI-generation markers, and the ingest markers —
are keyed by that position, so every insert/remove has to _shift_ them to stay aligned. The
shifting is implemented by `reindexAfterRemoval` (file map), `reindexSet` + `onRowRemoved`
(marker sets), and a global `fileInputKey` bump that force-remounts the uncontrolled file inputs
so surviving rows re-read their (reindexed) file.

This plan gives each row a stable client-side `id` (a `crypto.randomUUID()` minted at row
creation), keys all three state structures by `id`, and deletes the shift/remount machinery.
The one place index remains load-bearing — the submit boundary, where `resolveInvoiceMediaIds`
produces a **positional** mediaId array the server matches to rows by position — is handled by a
small id→position projection, leaving that function and its server contract untouched.

## Current State Analysis

- **Row identity = array index.** `LineItemsField` renders `lineItemsField.state.value.map((_, index) => …)` with `key={index}` (`line-items-field.tsx:212-213`); all field paths are `` `lineItems[${index}].field` ``.
- **File map keyed by index.** `useInvoiceFiles` holds `invoiceFilesRef: Map<number, File>` (`use-invoice-files.ts:33`). `handleRemoveLineItem` calls `reindexAfterRemoval` to shift it (`:35-38`); `registerFilesAt(startIndex, files)` writes at consecutive indices (`:68-79`).
- **Generation markers keyed by index.** `generatingIndices` / `failedIndices` are `Set<number>` (`use-receipt-generation.ts:38-39`); `onRowRemoved` shifts both via `reindexSet` (`:130-133`), which wraps the set as a map to reuse `reindexAfterRemoval` (`:26-29`).
- **Ingest markers keyed by index.** `ingestingIndices: Set<number>` in `expense-form.tsx:97`, mutated by `markIngesting(number[], busy)` (`:99-105`).
- **`fileInputKey` is a non-reactive-read re-render trigger.** `getFile` reads `invoiceFilesRef.current` (a ref → mutating it does not re-render). `fileInputKey` (`expense-form.tsx:92`) is bumped on remove (`:160`), reset (`:168`), each ingest batch (`:141`), and after AI rename (`:271`) purely to force the re-render so `getFile(index)` is re-read. It is threaded → `LineItemsField` → `LineItemInvoiceField` → `FileInput`'s `key` (`line-item-invoice-field.tsx:51`).
- **`FileInput` is uncontrolled.** It holds its own `fileName` in internal state seeded from `initialFileName` "only read at mount — remount via key to update it" (`file-input.tsx:13-16, 30`). `LineItemInvoiceField` shows `FileInput` when no file is attached and the controlled `InvoicePreviewTrigger` (`label={file.name}`) when one is (`line-item-invoice-field.tsx:48-69`).
- **Submit boundary is positional.** `onSubmit` calls `resolveInvoiceMediaIds(value.lineItems.length, files)` (`expense-form.tsx:232`), which walks `0..count-1` and returns `(number|undefined)[]` (`upload-file-client.ts:32-46`). The server matches mediaIds to rows by position.
- **Recovery is positional.** `recoveredFiles` is a `Map<number, File>` restored from the optimistic-form store after a failed submit (`use-form-submit.ts:12, 24`) and passed to `useInvoiceFiles(recoveredFiles)` (`expense-form.tsx:124`).
- **Two unit tests pin current behavior:** `use-invoice-files.test.ts` (reindex algebra) and `invoice-media-resolve.test.ts` (positional resolve).

### Key Discoveries:

- The index is **two roles fused**: (a) editor-lifecycle identity (shifts on edit → the bug class) and (b) the submit/recovery wire order. Only (a) should move to id; (b) stays positional.
- `resolveInvoiceMediaIds` and the server contract need **no change** — id→position projection happens in the caller.
- `fileInputKey` is orthogonal to keying: it is a re-render mechanism for a non-reactive ref. Removing it means making the file store reactive **state**, plus a mirror **ref** so async reads (`getFiles()` at submit, `getFiles()` in generation) never read a stale closure.
- Rows are ephemeral (AGENTS.md: kosztorys-adjacent expense data is throwaway is not the point here, but line-item rows never persist at all) — the `id` rides in form state and the Zustand draft harmlessly; `mapLineItem` already projects only known fields, so the server never sees it.

## Desired End State

Each row carries a stable `id`. Removing a mid-batch row leaves every surviving row's attached
file, "nie odczytano" marker, and in-flight spinner bound to the correct row with **zero**
reindexing. `reindexAfterRemoval`, `setFilesAt`'s index-shift, `reindexSet`, `onRowRemoved`, and
`fileInputKey` no longer exist. Submit still uploads the right file per row; recovery after a
failed submit still restores each row's file. Verified by: the rewritten + new unit tests pass,
typecheck/lint pass, and manual multi-receipt scan → remove-middle-row → submit works.

## What We're NOT Doing

- **Not** changing `resolveInvoiceMediaIds`'s signature or the server-side positional mediaId contract.
- **Not** touching `FormFileInput` (`form-components/form-file-input.tsx`) — it is a separate generic control used by `edit-transfer-form`, not the line-item flow.
- **Not** persisting ids or adding any migration/backfill — rows are ephemeral.
- **Not** changing `FileInput`'s public API (`initialFileName` etc.) — only ceasing to pass `fileInputKey` from the expense flow.
- **Not** re-litigating batch/ingest concurrency, HEIC handling, or the AI extraction flow.

## Implementation Approach

Additive-then-subtractive, ordered so each phase typechecks green:

1. Add `id` to the row shape + factory (unused by maps yet — pure addition).
2. Rekey all three state structures by `id` **and** add the submit/recovery boundary projection in one atomic phase — the type graph would go red if the map became `Map<string,File>` while the boundary still expected `Map<number,File>`, so they land together.
3. Retire `fileInputKey` by making the file store reactive.
4. Rewrite/extend the unit tests.

## Critical Implementation Details

**State sequencing (Phase 3).** `getFiles()` is called asynchronously — inside `onSubmit` and
inside `generateFromReceipts` — after `await`s. If the file store becomes plain `useState`, those
closures could read a stale Map. Keep a mirror ref updated every render
(`filesRef.current = files`) and have `getFile`/`getFiles` read the **ref** for correctness, while
the reactive `files` state drives re-render. Batch ingest mutates the map from concurrent tasks →
all writes must be functional `setState(prev => new Map(prev)…)` updates, never in-place mutation.

**Reset clears native selection via id, not remount key (Phase 3).** Today a form reset bumps
`fileInputKey` to remount the uncontrolled `FileInput` and clear its native `FileList`. After the
change, the reset-produced blank row must be minted with a **fresh** `id`, so its stable React key
changes and the row (hence `FileInput`) remounts naturally. Verify the `form.reset()` path and
`resetConditionalFields` both yield fresh-id rows.

## Phase 1: Row id foundation

### Overview

Add a stable `id` to the line-item shape and mint it at every row-creation site. No state is
keyed by it yet — this phase is purely additive and behavior-neutral.

### Changes Required:

#### 1. Client schema

**File**: `src/components/forms/expense-form/expense-schema.ts`

**Intent**: Add `id` to `lineItemClientSchema` so form values validate with it present. Leave the
server-side schema (`lineItemSchema`, numeric amounts) untouched — the server never receives `id`.

**Contract**: `lineItemClientSchema` gains `id: z.string()`.

#### 2. Form values type

**File**: `src/components/forms/expense-form/bulk-expense-form.ts`

**Intent**: Add `id` to the `lineItems[number]` shape in `BulkExpenseFormValuesT` so all field
wiring is type-aware of it.

**Contract**: `lineItems` element type gains `id: string`.

#### 3. Row factory

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: Replace the `EMPTY_LINE_ITEM` constant with a `makeLineItem()` factory that returns a
fresh row including `id: crypto.randomUUID()`, so every pushed row is unique. Update the
`emptyItem` derivation (default expense category) to call it. Switch the render key from `index`
to `item.id`.

**Contract**: `makeLineItem(overrides?: Partial<…>) => LineItem`; `key={item.id}`; every
`pushValue(…)` and the reuse-first-row path use `makeLineItem(…)`.

#### 4. Default + reset row-creation sites

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: The `defaultValues.lineItems[0]` literal (`:183-191`) must also carry an `id`. Since
`crypto.randomUUID()` must run per-instance, seed the initial row through the same factory (import
it, or a shared `makeLineItem`). Ensure `form.reset()` / `resetField('lineItems')` land a
fresh-id row (see Critical Implementation Details).

**Contract**: initial `lineItems` seeded via the factory; no raw row literal without an `id`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` (or the project's typecheck script)
- Linting passes: `pnpm lint`
- Existing tests still pass: `pnpm exec vitest run src/__tests__/use-invoice-files.test.ts src/__tests__/invoice-media-resolve.test.ts`

#### Manual Verification:

- Add-expense form opens with one blank row; "Dodaj pozycję" adds rows; no console errors.

---

## Phase 2: Rekey file map, generation & ingest markers by id (+ submit/recovery boundary)

### Overview

The atomic core: switch every out-of-form structure from index-keyed to id-keyed, delete the
shift machinery, and add the id→position projection at the submit + recovery boundaries in the
same phase so the type graph stays green.

### Changes Required:

#### 1. Invoice file map → id-keyed

**File**: `src/components/forms/hooks/use-invoice-files.ts`

**Intent**: Change `Map<number, File>` → `Map<string, File>`. Delete `reindexAfterRemoval`
entirely and its use in `handleRemoveLineItem` — removing a row now just deletes that id's entry
(no shift). `handleFileChange`, `getFile`, `renameFile` take an `id: string`. `registerFilesAt`
takes the ids of the target rows instead of `(startIndex, files)` — pair each file with its row's
id. Keep `setFilesAt` only if still used; otherwise delete.

**Contract**: `handleRemoveLineItem(id, removeValue, index)` (still needs `index` for TanStack's
positional `removeValue`); `handleFileChange(id, e)`; `getFile(id)`; `renameFile(id, name)`;
`registerFilesAt(ids: string[], files: File[])`; `getFiles(): Map<string, File>`. Note: `id` and
`index` are both needed at the remove call site — id for the file map, index for `removeValue`.

#### 2. Generation markers → id-keyed

**File**: `src/components/forms/hooks/use-receipt-generation.ts`

**Intent**: `generatingIndices` / `failedIndices` → `Set<string>` keyed by row id. Delete
`reindexSet` and `onRowRemoved` (removal no longer shifts markers — a removed row's id simply
stops existing). In `generateFromReceipts`, derive eligibility from rows carrying `{ id, index }`:
use `id` for the file-map lookup and marker sets, and `index` for `form.setFieldValue`
(`` `lineItems[${index}].…` `` stays positional).

**Contract**: markers are `Set<string>`; `generateFromReceipts` maps rows to `{ row, id, index }`;
`getFiles()` returns `Map<string,File>`; the hook no longer exports `onRowRemoved`.

#### 3. Ingest markers → id-keyed

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: `ingestingIndices` → id-keyed `Set<string>`; `markIngesting(ids: string[], busy)`.
`handleRegisterFiles` and `handleAttachFile` pass row ids. `handleRemove` drops the
`onRowRemoved(index)` call (deleted) — it now only deletes the file entry by id and removes the
row. Update the `LineItemsField` props it passes (`generatingIndices`/`failedIndices`/
`ingestingIndices` are now id sets; `getFile`/`onFileChange`/`onRegisterFiles` are id-based).

**Contract**: id-keyed sets throughout; `handleRemove(id, index, removeValue)`.

#### 4. Line-items field wiring → id-based

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: In the row map, read `item.id` and pass it (not just `index`) to `onRemoveItem`,
`onFileChange`, `getFile`, and the marker `.has(...)` checks. `scanReceipts` computes the ids of
the rows it pushes and passes them to `onRegisterFiles(ids, picked)` — for the reuse-first-row
case, include row 0's existing id. Field paths (`` `lineItems[${index}].…` ``) stay index-based.

**Contract**: `onRemoveItem(id, index, removeValue)`; `onFileChange(id, e)`; `getFile(id)`;
`onRegisterFiles(ids: string[], files: File[])`; marker checks use `item.id`.

#### 5. `LineItemInvoiceField` id prop

**File**: `src/components/forms/form-fields/line-item-invoice-field.tsx`

**Intent**: Accept `id` and call `onFileChange(id, e)`. (The `fileInputKey` prop stays for now —
removed in Phase 3.)

**Contract**: prop `id: string`; `onFileChange(id, e)`.

#### 6. Submit boundary projection

**File**: `src/components/forms/expense-form/expense-form.tsx` (onSubmit) — and a small helper.

**Intent**: `resolveInvoiceMediaIds` keeps its positional `(count, Map<number,File>)` contract.
Before calling it, project the id-keyed map to a positional `Map<number,File>` by walking
`value.lineItems` in order and mapping `index → files.get(item.id)`. This is the single conversion
point from id-space back to wire-order.

**Contract**: a pure `positionalFiles(lineItems, byId: Map<string,File>): Map<number,File>` (place
next to `resolveInvoiceMediaIds` in `upload-file-client.ts`, or colocated as a small helper) →
fed to the unchanged `resolveInvoiceMediaIds`. `resolveInvoiceMediaIds` and the server are untouched.

#### 7. Recovery hydration projection

**File**: `src/components/forms/hooks/use-form-submit.ts` + `expense-form.tsx`

**Intent**: `recoveredFiles` is a `Map<number,File>` persisted at the _previous_ submit (already in
wire order). On recovery, the restored `storedValues.lineItems` carry the ids they had at submit
time. Re-key the recovered positional map to id-space by aligning position→id against the recovered
rows, then seed `useInvoiceFiles` with the id-keyed map. Decide the cleanest seam: either convert
inside `expense-form` right before `useInvoiceFiles(recovered)`, using `storedValues.lineItems`, or
have `useFormSubmit` expose enough to do it there. Prefer converting in `expense-form` where both
the recovered map and `storedValues` are in scope.

**Contract**: `useInvoiceFiles` receives an id-keyed `Map<string,File>` on recovery; the
position→id alignment uses the recovered `lineItems` order. Guard the length-mismatch edge (fewer
recovered rows than files) by dropping unmatched entries.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- (Phase-4 rewrites the two unit tests; until then they may be red — do not treat as a gate here. Prefer landing Phase 2 + Phase 4 test rewrites close together, or temporarily xfail. See Testing Strategy.)

#### Manual Verification:

- Batch-scan 3 receipts → each row shows its own image + AI-filled fields.
- Remove the **middle** row mid-list → the other two keep their correct images and any "nie odczytano" markers (no marker/image jumps to the wrong row).
- Submit → each saved line item has its correct invoice attached.
- Trigger a failed submit (e.g. offline) then recover → each row still shows its file.

---

## Phase 3: Retire `fileInputKey` (reactive file store + controlled FV label)

### Overview

Make the invoice file store reactive so the FV label updates without a remount trigger, and delete
`fileInputKey` from the whole flow.

### Changes Required:

#### 1. Reactive file store + mirror ref

**File**: `src/components/forms/hooks/use-invoice-files.ts`

**Intent**: Replace `invoiceFilesRef` (`useRef`) with `useState<Map<string,File>>` for reactivity,
plus a mirror `filesRef` assigned every render (`filesRef.current = files`) so `getFiles()` and
`getFile()` used in async paths read the latest committed map (no stale closures). All mutators
(`handleFileChange`, `registerFilesAt`, `renameFile`, `handleRemoveLineItem`, `reset`) become
functional `setFiles(prev => …)` updates. See Critical Implementation Details.

**Contract**: `const [files, setFiles] = useState<Map<string,File>>(…)`; `filesRef.current = files`
each render; reads go through `filesRef`, writes through `setFiles` functional updates.

#### 2. Remove `fileInputKey` from expense-form

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: Delete the `fileInputKey` state and every bump (`handleRemove`, `handleReset`,
`runIngest` finally, `handleGenerate`, `resetConditionalFields`). The reactive store now drives
re-render on attach/rename/remove; a fresh-id blank row on reset remounts naturally (Phase 1
guarantees fresh ids on reset). Stop passing `fileInputKey` to `LineItemsField`.

**Contract**: no `fileInputKey` symbol remains in the file; `handleGenerate` just awaits
`generateFromReceipts()` (rename now re-renders via reactive store).

#### 3. Drop `fileInputKey` prop threading

**Files**: `src/components/forms/form-fields/line-items-field.tsx`,
`src/components/forms/form-fields/line-item-invoice-field.tsx`

**Intent**: Remove the `fileInputKey` prop from both components. In `LineItemInvoiceField` the
empty-state `<FileInput>`'s `key` no longer needs the bump — the row's stable `id` key (from the
parent map) already gives it a stable identity, and a reset mints a new id. Keep `FileInput` itself
unchanged (shared component).

**Contract**: neither component accepts or references `fileInputKey`; `FileInput` public API untouched.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- `grep -rn fileInputKey src/` returns nothing.

#### Manual Verification:

- Attach a file to a row → the FV label/thumbnail appears immediately (no flicker/remount).
- Run AI scan → renamed FV labels update in place.
- Reset the form → file inputs clear; re-picking the same file fires onChange (native selection cleared).
- Remove a row mid-generation is still blocked while its spinner shows (unchanged guard).

---

## Phase 4: Tests

### Overview

Retarget the two existing unit tests to the id-keyed contract and add a focused test for the bug
class the ticket exists to kill.

### Changes Required:

#### 1. Rewrite file-map unit test

**File**: `src/__tests__/use-invoice-files.test.ts`

**Intent**: Drop the `reindexAfterRemoval` shift assertions (function deleted). Assert the id-keyed
behavior: set/get/rename/remove by id; removing a row deletes only its id's entry and leaves other
ids untouched; `registerFilesAt(ids, files)` pairs each file with its id.

**Contract**: tests exercise the exported id-based API; no `reindexAfterRemoval` reference.

#### 2. Rewrite media-resolve / boundary test

**File**: `src/__tests__/invoice-media-resolve.test.ts`

**Intent**: `resolveInvoiceMediaIds` is unchanged — keep its positional tests. Add coverage for the
new `positionalFiles(lineItems, byId)` projection: correct index→file alignment, rows without a
file → `undefined`, and a row whose id is missing from the map → `undefined`.

**Contract**: positional-resolve tests intact; new projection tests added.

#### 3. New id-identity regression test

**File**: `src/__tests__/use-invoice-files.test.ts` (or a sibling)

**Intent**: Pin the exact defect: register files for rows `[A, B, C]` by id, remove `B`, assert `A`
and `C` still resolve to their original files and no entry shifted onto the wrong id. Mirror the
same for the generation marker sets if practical (id membership survives a sibling removal).

**Contract**: a test named for remove-mid-batch id stability that would fail under the old
index-shift model.

### Success Criteria:

#### Automated Verification:

- All targeted tests pass: `pnpm exec vitest run src/__tests__/use-invoice-files.test.ts src/__tests__/invoice-media-resolve.test.ts`
- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- None beyond Phase 2/3 manual checks.

---

## Testing Strategy

### Unit Tests:

- id-keyed file map algebra (set/get/rename/remove by id; remove deletes only that id).
- `positionalFiles` projection (index alignment, missing file → undefined, missing id → undefined).
- Remove-mid-batch id stability (the regression guard).

### Integration / E2E:

- EX-447's receipt-batch-scan e2e (row-removal / fill-race / stale-filename) is the cross-boundary
  regression net. Confirm it exists and passes; if it does not yet exist, the manual checks below
  stand in and the e2e is owed to the `e2e-backlog` per AGENTS.md.

### Manual Testing Steps:

1. Batch-scan 3+ receipts; confirm each row's image + AI fields.
2. Remove the middle row; confirm images/markers stay with the correct rows.
3. Submit; confirm each line item saved with its correct invoice.
4. Force a failed submit, recover; confirm each row's file is restored.
5. AI rename updates FV labels in place; reset clears inputs and allows re-pick.

## Migration Notes

None. Rows are ephemeral client state; `id` never persists and the server contract is unchanged.

## References

- Ticket: EX-448 (parent EX-443); regression net EX-447.
- Submit boundary: `src/lib/utils/upload-file-client.ts:32`
- Recovery: `src/components/forms/hooks/use-form-submit.ts:24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Row id foundation

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Existing use-invoice-files + invoice-media-resolve tests still pass

### Phase 2: Rekey by id (+ submit/recovery boundary)

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes

### Phase 3: Retire fileInputKey

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 `grep -rn fileInputKey src/` returns nothing

### Phase 4: Tests

#### Automated

- [ ] 4.1 Targeted vitest files pass
- [ ] 4.2 Type checking passes
- [ ] 4.3 Linting passes
