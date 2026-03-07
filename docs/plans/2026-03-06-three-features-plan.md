# Three Features Implementation Plan

> **Status:** ✅ Merged — PR #2 + follow-up commits on main (2026-03-06)

**Goal:** Add drag-and-drop file input, invoice removal from transactions, and multi-select transfer type filter.

## Post-merge additions (committed directly to main)

- All entity filters (cash register, investment, created-by) converted to multi-select
- Transaction ID column added as first column in transfers table
- Multi-select UX inverted: all selected by default, deselect to filter (matching ColumnToggle pattern)
- "Widoczne transakcje" header in filter dropdowns
- Security fix: `createdBy` URL param can't override `onlyOwnTransfers` scope
- Extracted `getStringParam`/`parseNumericIds` helpers in backend, `getMultiParam` in frontend

**Architecture:** Three independent features touching different areas of the codebase. No dependencies between them — can be implemented in any order. All follow existing patterns (server actions with `withAction`, URL-param filters, shadcn UI).

**Tech Stack:** Next.js 16, TanStack Form, Payload CMS, shadcn UI, Tailwind 4, HTML5 Drag and Drop API

---

## Task 1: Drag-and-Drop File Input

**Files:**

- Modify: `src/components/ui/file-input.tsx`

**Step 1: Replace the current `FileInput` with a drop zone wrapper**

The current component is a plain `<input type="file">`. Wrap it with drag-and-drop support using HTML5 events. The drop zone should:

- Show dashed border with "Przeciągnij plik lub kliknij" text
- Highlight on drag hover (change border color/style)
- Accept the same `accept` prop to validate file types
- Forward all existing props (ref, className, onChange, etc.)
- Keep the native `<input>` hidden, triggered on click of the zone

```tsx
'use client'

import * as React from 'react'
import { useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'

type FileInputPropsT = React.ComponentProps<'input'> & {
  label?: string
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputPropsT>(
  ({ className, label, onChange, accept, ...props }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false)
    const [fileName, setFileName] = useState<string>()
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }

    function handleDragLeave(e: React.DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (!file) return

      // Validate against accept prop
      if (accept && !matchesAccept(file, accept)) return

      // Set the file on the input element and fire onChange
      const dt = new DataTransfer()
      dt.items.add(file)
      if (inputRef.current) {
        inputRef.current.files = dt.files
        const event = new Event('change', { bubbles: true })
        inputRef.current.dispatchEvent(event)
      }
      setFileName(file.name)
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      setFileName(file?.name)
      onChange?.(e)
    }

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 transition-colors',
          'text-muted-foreground hover:border-primary/50 hover:bg-muted/50',
          isDragOver && 'border-primary bg-muted/50',
          className,
        )}
      >
        <Upload className="mb-2 size-6" />
        <span className="text-sm">{fileName ?? label ?? 'Przeciągnij plik lub kliknij'}</span>
        <input
          ref={setRefs}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
      </div>
    )
  },
)

FileInput.displayName = 'FileInput'

function matchesAccept(file: File, accept: string): boolean {
  const allowed = accept.split(',').map((s) => s.trim())
  return allowed.some((pattern) => {
    if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase())
    if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'))
    return file.type === pattern
  })
}

export { FileInput }
```

**Step 2: Verify consumers still work**

Check that these files compile without errors (they use `FileInput`):

- `src/components/forms/form-fields/line-items-field.tsx`
- `src/components/forms/form-components/form-file-input.tsx`
- `src/components/dialogs/invoice-upload-dialog.tsx`

Run: `pnpm typecheck`

**Step 3: Manual test**

1. Open a transfer form with invoice upload
2. Verify: click on drop zone opens file picker
3. Verify: drag a file onto the zone highlights it
4. Verify: drop a file shows filename and attaches it

**Step 4: Commit**

```bash
git add src/components/ui/file-input.tsx
git commit -m "feat: add drag-and-drop support to FileInput component"
```

---

## Task 2: Remove Invoice from Transaction

### Task 2a: Server Action

**Files:**

- Modify: `src/lib/actions/transfers.ts` (add after line 212)

**Step 1: Add `removeTransferInvoiceAction`**

Follows the exact same pattern as `updateTransferInvoiceAction` (line 192) but clears the field and deletes the media doc.

```ts
export async function removeTransferInvoiceAction(transferId: number) {
  return withAction(
    'removeTransferInvoiceAction',
    async ({ payload }) => {
      const step = perfStart()

      const transfer = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })

      const mediaId = typeof transfer.invoice === 'number' ? transfer.invoice : null
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { invoice: null },
      })
      console.log(`[PERF]   clear invoice field ${step()}ms`)

      if (mediaId) {
        await payload.delete({
          collection: 'media',
          id: mediaId,
        })
        console.log(`[PERF]   delete media(${mediaId}) ${step()}ms`)
      }

      return { success: true }
    },
    ['transfers'],
  )
}
```

**Step 2: Verify typecheck**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "feat: add removeTransferInvoiceAction server action"
```

### Task 2b: UI — Add Remove Button to Preview Dialog

**Files:**

- Modify: `src/components/dialogs/invoice-preview-dialog.tsx` (add `onRemove` prop + button)
- Modify: `src/components/transfers/invoice-cell.tsx` (wire up `onRemove` callback)

**Step 1: Add `onRemove` prop and button to `InvoicePreviewDialog`**

In `src/components/dialogs/invoice-preview-dialog.tsx`:

Add to imports:

```ts
import { Download, Printer, Replace, Trash2 } from 'lucide-react'
```

Add to props type (after `onReplace`):

```ts
readonly onRemove?: () => void
```

Add to destructured props:

```ts
onRemove,
```

Add button in `DialogFooter` before the Replace button (line 73):

```tsx
{
  onRemove && (
    <Button variant="destructive" onClick={onRemove}>
      <Trash2 />
      Usuń
    </Button>
  )
}
```

**Step 2: Wire up `onRemove` in `InvoiceCell`**

In `src/components/transfers/invoice-cell.tsx`:

Add import:

```ts
import { useRouter } from 'next/navigation'
import { removeTransferInvoiceAction } from '@/lib/actions/transfers'
```

Inside `InvoiceCell`, add after `handleReplace`:

```ts
const router = useRouter()

async function handleRemove() {
  if (!confirm('Czy na pewno chcesz usunąć fakturę?')) return
  setPreviewOpen(false)
  const result = await removeTransferInvoiceAction(transactionId)
  if (result.success) router.refresh()
}
```

Pass to `InvoicePreviewDialog`:

```tsx
onRemove = { handleRemove }
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck`

**Step 4: Manual test**

1. Open a transfer with an invoice (click FileText icon)
2. Verify: "Usuń" button appears in red
3. Click "Usuń" → browser confirm dialog appears
4. Confirm → dialog closes, invoice icon changes to Plus
5. Verify the media file is deleted (check Payload admin)

**Step 5: Commit**

```bash
git add src/components/dialogs/invoice-preview-dialog.tsx src/components/transfers/invoice-cell.tsx
git commit -m "feat: add remove invoice from transaction"
```

---

## Task 3: Multi-Select Transfer Type Filter

### Task 3a: Update Backend Filter Logic

**Files:**

- Modify: `src/lib/queries/transfers.ts` (lines 72-76)

**Step 1: Change type filter to support comma-separated values**

Replace lines 72-76 in `buildTransferFilters`:

```ts
// Type filter (supports comma-separated multi-select)
const typeParam = typeof searchParams.type === 'string' ? searchParams.type : undefined
if (typeParam) {
  const types = typeParam.split(',')
  where.type = types.length === 1 ? { equals: types[0] } : { in: types }
}
```

**Step 2: Verify typecheck**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add src/lib/queries/transfers.ts
git commit -m "feat: support multi-select type filter in transfer queries"
```

### Task 3b: Multi-Select Filter Component

**Files:**

- Modify: `src/components/transfers/transfer-filters.tsx` (replace type FilterSelect with DropdownMenu)

**Step 1: Add imports**

Add to existing imports in `transfer-filters.tsx`:

```ts
import { CheckIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

**Step 2: Create `FilterMultiSelect` component**

Add at the bottom of the file (after `FilterSelect`). Follows the exact pattern of `src/components/ui/column-toggle.tsx`:

```tsx
type FilterMultiSelectPropsT = {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: FilterOptionT[]
}

function FilterMultiSelect({ values, onValuesChange, options }: FilterMultiSelectPropsT) {
  function toggleValue(value: string) {
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
    onValuesChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-40 justify-start gap-1.5">
          {values.length === 0 ? 'Wszystkie' : `Wybrano (${values.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={(e) => e.preventDefault()}
            onClick={() => toggleValue(opt.value)}
          >
            <CheckIcon className={cn('size-4', !values.includes(opt.value) && 'opacity-0')} />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 3: Replace the type filter usage**

In the `TransferFilters` component, replace the type filter section (lines 108-118).

Change `currentType` parsing (line 41):

```ts
const currentTypes = (searchParams.get('type') ?? '').split(',').filter(Boolean)
```

Replace the type filter JSX:

```tsx
{
  showTypeFilter && (
    <FilterField label="Typ">
      <FilterMultiSelect
        values={currentTypes}
        onValuesChange={(types) => updateParam('type', types.join(','))}
        options={TRANSFER_TYPES.map((t) => ({
          value: t,
          label: TRANSFER_TYPE_LABELS[t],
        }))}
      />
    </FilterField>
  )
}
```

Update `hasEntityFilters` (line 90) to use `currentTypes.length > 0` instead of `currentType`:

```ts
const hasEntityFilters =
  currentTypes.length > 0 || currentSourceRegister || currentInvestment || currentCreatedBy
```

Remove the now-unused `currentType` variable (line 41).

**Step 4: Add `Button` to imports if not already imported**

Check if `Button` is already imported in `transfer-filters.tsx`. It is (line 13). Good — no change needed.

Add `cn` import if not present. It is (line 18). Good.

**Step 5: Verify typecheck**

Run: `pnpm typecheck`

**Step 6: Manual test**

1. Go to transfers page
2. Click "Typ" filter dropdown
3. Verify: all transfer types listed with check icons
4. Click multiple types — check icons appear, button shows "Wybrano (N)"
5. Verify: URL updates with comma-separated types (`?type=PAYOUT,OTHER`)
6. Verify: table shows only matching transfer types
7. Click "Wyczyść filtry" — all types deselected, shows all transfers

**Step 7: Commit**

```bash
git add src/components/transfers/transfer-filters.tsx
git commit -m "feat: multi-select transfer type filter matching ColumnToggle pattern"
```

---

## Reference Files

| File                                                | Purpose                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/ui/file-input.tsx`                  | File input component to enhance with drag-and-drop                     |
| `src/components/ui/column-toggle.tsx`               | Reference pattern for multi-select dropdown (DropdownMenu + CheckIcon) |
| `src/components/transfers/transfer-filters.tsx`     | Filter bar — type filter to convert to multi-select                    |
| `src/components/transfers/invoice-cell.tsx`         | Invoice table cell — wire up remove callback                           |
| `src/components/dialogs/invoice-preview-dialog.tsx` | Preview dialog — add remove button                                     |
| `src/lib/actions/transfers.ts`                      | Server actions — add `removeTransferInvoiceAction`                     |
| `src/lib/queries/transfers.ts`                      | Query builder — update `buildTransferFilters` for multi-type           |
| `src/lib/actions/utils.ts`                          | `withAction` wrapper pattern reference                                 |
| `src/lib/constants/transfers.ts`                    | Transfer type constants and labels                                     |
| `src/collections/media.ts`                          | Media collection — delete access is `isAdminOrOwner`                   |
