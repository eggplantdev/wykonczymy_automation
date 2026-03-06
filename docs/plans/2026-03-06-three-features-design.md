# Three Features Design

## Status: Approved

## Feature 1: Drag-and-Drop File Input

**Goal:** Enhance file input with drop zone so users can drag files instead of clicking.

**Approach:** Vanilla HTML5 Drag and Drop API — no external dependencies.

**Changes:**
- `src/components/ui/file-input.tsx` — add `onDrop`, `onDragOver`, `onDragLeave` handlers. Wrap input in a visible drop zone with dashed border. Highlight on drag hover. Text: "Przeciągnij plik lub kliknij".
- All consumers (`LineItemsField`, `InvoiceUploadDialog`) get drag-and-drop automatically.

**Reference:** HTML5 `ondrop` / `ondragover` events. No library needed.

## Feature 2: Remove Invoice from Transaction

**Goal:** Allow users to delete an uploaded invoice from a transfer (currently only add/replace exists).

**Changes:**
- `src/components/dialogs/invoice-preview-dialog.tsx` — add "Usuń" button with confirmation.
- `src/lib/actions/transfers.ts` — new `removeTransferInvoiceAction(transferId)`:
  1. Read transfer to get media ID
  2. Set `transfer.invoice` to `null`
  3. Delete the media doc from Payload (cascades to Vercel Blob)
  4. Revalidate cache
- `InvoiceCell` already handles `null` invoice (shows Plus icon) — no change needed.

**Reference:**
- Existing pattern: `updateTransferInvoiceAction` in `src/lib/actions/transfers.ts` (lines 192-212)
- Existing pattern: `NoteCell` in `src/components/dialogs/note-dialog.tsx` (has edit/clear pattern)
- Media delete access: `isAdminOrOwner` in `src/collections/media.ts`

## Feature 3: Multi-Select Transfer Type Filter

**Goal:** Filter transactions by multiple types simultaneously (currently single-select only).

**Approach:** Replicate the `ColumnToggle` pattern — `DropdownMenu` with `CheckIcon` per item.

**Changes:**
- `src/components/transfers/transfer-filters.tsx`:
  - Replace `FilterSelect` for type with new `FilterMultiSelect` component
  - Uses `DropdownMenu` + `DropdownMenuItem` + `CheckIcon` (same as `ColumnToggle`)
  - Selected types shown as count badge on trigger button
- URL param: `?type=INVESTOR_DEPOSIT,PAYOUT` (comma-separated)
- `src/lib/queries/transfers.ts` — `buildTransferFilters()`:
  - Parse comma-separated `type` param
  - Single value → `{ equals: value }` (unchanged)
  - Multiple values → `{ in: values }`
- `transfer-filters.tsx` `clearEntityFilters()` already clears `type` param — no change needed.

**Reference:**
- `src/components/ui/column-toggle.tsx` — exact UI pattern to replicate (DropdownMenu + CheckIcon toggle)
- `src/lib/constants/transfers.ts` — `TRANSFER_TYPES` array + `TRANSFER_TYPE_LABELS` for options

## Out of Scope

- **"Koszty robocizny" (labor costs)** — new transaction type, deferred to separate design session
- **Refresh token flow** — documented in `docs/plans/2026-03-06-refresh-token.md`
