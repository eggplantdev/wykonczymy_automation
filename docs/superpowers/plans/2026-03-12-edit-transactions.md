# Edit Transactions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing non-financial metadata fields on transactions via a new edit dialog, consolidating inline note editing.

**Architecture:** New `updateTransferAction` server action with permission checks (MANAGER own only, ADMIN/OWNER any). Lightweight edit dialog component triggered from table actions column. Uses `useTransition` + `router.refresh()` pattern (same as cancel button). Payload field-level access controls loosened for 8 editable fields while keeping financial fields locked.

**Tech Stack:** Next.js 16, Payload CMS 3.73, Zod 4, Shadcn UI, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-12-edit-transactions-design.md`

---

## Chunk 1: Data Layer (Schema, Collection, Action, Tests)

### Task 1: Add `updateTransferSchema` to validation schemas

**Files:**

- Modify: `src/lib/schemas/transfer.ts`

- [ ] **Step 1: Add the update schema after the existing `createTransferSchema`**

```typescript
// After the existing createTransferSchema and its type export

export const updateTransferSchema = z.object({
  description: z.string().optional().default(''),
  date: z.string().min(1, 'Data jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  investment: z.number().optional(),
  expenseCategory: z.number().optional(),
  otherCategory: z.number().optional(),
  otherDescription: z.string().optional(),
  invoiceNote: z.string().optional(),
})

export type UpdateTransferFormT = z.infer<typeof updateTransferSchema>
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas/transfer.ts
git commit -m "feat: add updateTransferSchema for edit transactions"
```

---

### Task 2: Add `updatedBy` field and unlock editable fields in Payload collection

**Files:**

- Modify: `src/collections/transfers.ts`

- [ ] **Step 1: Remove `access: { update: () => false }` from the 8 editable fields**

Remove the `access: { update: () => false }` line from these fields:

- `description`
- `date`
- `paymentMethod`
- `investment`
- `expenseCategory`
- `otherCategory`
- `otherDescription`
- `invoiceNote` — already has no access restriction

Keep `access: { update: () => false }` on: `amount`, `type`, `sourceRegister`, `targetRegister`, `worker`.

- [ ] **Step 2: Add `updatedBy` field after `createdBy`**

```typescript
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Updated By', pl: 'Zaktualizowane przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
```

- [ ] **Step 3: Generate Payload types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` regenerated with `updatedBy` field on Transaction type

- [ ] **Step 4: Create migration**

Run: `pnpm migrate:create`
Expected: New migration file created in `src/migrations/`

- [ ] **Step 5: Verify it compiles**

Run: `pnpm typecheck`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/collections/transfers.ts src/migrations/
git commit -m "feat: unlock editable fields and add updatedBy to transfers collection"
```

---

### Task 3: Write tests for `updateTransferAction`

**Files:**

- Modify: `src/__tests__/transfer-actions.test.ts`

- [ ] **Step 1: Add `updateTransferAction` to the dynamic import block**

Add `updateTransferAction` to the destructured dynamic import block:

```typescript
const {
  createTransferAction,
  createBulkTransferAction,
  cancelTransferAction,
  updateTransferAction,
  updateTransferNoteAction,
  updateTransferInvoiceAction,
} = await import('@/lib/actions/transfers')
```

Keep `updateTransferNoteAction` for now — its tests still exist and the action is still alive until Task 8.

- [ ] **Step 2: Add helper for update data**

```typescript
function makeUpdateData(overrides = {}) {
  return {
    description: 'Updated description',
    date: '2026-03-01',
    paymentMethod: 'CASH' as const,
    investment: 1,
    expenseCategory: 1,
    invoiceNote: 'Updated note',
    ...overrides,
  }
}
```

- [ ] **Step 3: Write test suite for `updateTransferAction`**

Replace the `updateTransferNoteAction` describe block with:

```typescript
describe('updateTransferAction', () => {
  it('success → updates transaction with editable fields + updatedBy', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: expect.objectContaining({
          description: 'Updated description',
          date: '2026-03-01',
          paymentMethod: 'CASH',
          updatedBy: adminUser.id,
        }),
      }),
    )
  })

  it('cancelled transaction → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ cancelled: true }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Nie można edytować anulowanej transakcji.')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('CANCELLATION type → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'CANCELLATION', createdBy: adminUser.id }),
    )

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Nie można edytować anulowanej transakcji.')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('transaction not found → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(null)

    const result = await updateTransferAction(999, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja nie istnieje.')
  })

  it('permission: MANAGER can edit own transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('permission: MANAGER cannot edit another users transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: otherManagerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Nie masz uprawnień do edycji tej transakcji.')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('permission: ADMIN can edit any transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: adminUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('permission: OWNER can edit any transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: ownerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('createdBy as populated object → extracts id correctly', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: { id: managerUser.id, name: 'Manager' } }),
    )
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('payload.update failure → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Update failed')
  })

  it('passes all existing fields to payload.update for hook compatibility', async () => {
    const original = makeOriginalTransfer({
      createdBy: adminUser.id,
      sourceRegister: 5,
      investment: 2,
      type: 'INVESTMENT_EXPENSE',
    })
    mockFindByID.mockResolvedValueOnce(original)

    await updateTransferAction(10, makeUpdateData({ investment: 3 }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investment: 3,
          updatedBy: adminUser.id,
        }),
      }),
    )
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/transfer-actions.test.ts`
Expected: FAIL — `updateTransferAction` is not exported

- [ ] **Step 5: Commit failing tests**

```bash
git add src/__tests__/transfer-actions.test.ts
git commit -m "test: add failing tests for updateTransferAction"
```

---

### Task 4: Implement `updateTransferAction`

**Files:**

- Modify: `src/lib/actions/transfers.ts`

- [ ] **Step 1: Add import for the new schema**

Update the schema import at the top of the file:

```typescript
import {
  createTransferSchema,
  updateTransferSchema,
  type CreateTransferFormT,
  type UpdateTransferFormT,
} from '@/lib/schemas/transfer'
```

- [ ] **Step 2: Add `updateTransferAction` after `updateTransferNoteAction`**

Keep `updateTransferNoteAction` for now (NoteCell still imports it until Task 8). Add the new action after it (after the closing `}` of `updateTransferNoteAction`):

```typescript
export async function updateTransferAction(transferId: number, data: UpdateTransferFormT) {
  return withAction(
    'updateTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(updateTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      const original = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if (!original) return { success: false, error: 'Transakcja nie istnieje.' }
      if (original.cancelled || original.type === 'CANCELLATION') {
        return { success: false, error: 'Nie można edytować anulowanej transakcji.' }
      }

      const creatorId =
        typeof original.createdBy === 'number' ? original.createdBy : original.createdBy?.id
      if (user.id !== creatorId && !isAdminOrOwnerRole(user.role)) {
        return { success: false, error: 'Nie masz uprawnień do edycji tej transakcji.' }
      }

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: {
          ...parsed.data,
          updatedBy: user.id,
        },
      })
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- src/__tests__/transfer-actions.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "feat: implement updateTransferAction for editing transactions"
```

- [ ] **Step 6: Run /simplify**

Review the data layer changes for code quality and reuse.

---

## Chunk 2: Table Data Layer (TransferRowT, mapTransferRow)

### Task 5: Add `createdById`, `otherCategoryId`, and `otherDescription` to `TransferRowT`

**Files:**

- Modify: `src/lib/tables/transfers.tsx`

- [ ] **Step 1: Add new fields to `TransferRowT`**

Add after the `otherCategoryName` field:

```typescript
  readonly otherCategoryId: number | null
  readonly otherDescription: string
  readonly createdById: number | null
```

- [ ] **Step 2: Update `mapTransferRow` lookups branch**

In the lookups branch, add the three new fields after `otherCategoryName`:

```typescript
      otherCategoryId: toNullableId(doc.otherCategory),
      otherDescription: doc.otherDescription ?? '',
      createdById: toNullableId(doc.createdBy),
```

- [ ] **Step 3: Update `mapTransferRow` fallback branch**

In the non-lookups branch, add after `otherCategoryName`:

```typescript
    otherCategoryId: toNullableId(doc.otherCategory),
    otherDescription: doc.otherDescription ?? '',
    createdById: toNullableId(doc.createdBy),
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors (new fields are additive)

- [ ] **Step 5: Run existing tests**

Run: `pnpm test -- src/__tests__/transfer-table.test.ts`
Expected: May need to update test fixtures if they assert exact shape. Fix any failures by adding the new fields to test fixtures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tables/transfers.tsx
git commit -m "feat: add createdById, otherCategoryId, otherDescription to TransferRowT"
```

---

## Chunk 3: UI Components (Edit Dialog, Edit Button, Table Integration)

### Task 6: Create `EditTransferButton` component with dialog

**Files:**

- Create: `src/components/transfers/edit-transfer-button.tsx`

- [ ] **Step 1: Create the edit button + dialog component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { updateTransferAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'
import {
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  showsInvestment,
  needsExpenseCategory,
  needsOtherCategory,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/format-currency'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type EditTransferButtonPropsT = {
  readonly row: TransferRowT
  readonly referenceData: ReferenceDataBaseT
  readonly canEdit: boolean
}

export function EditTransferButton({ row, referenceData, canEdit }: EditTransferButtonPropsT) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Form state
  const [description, setDescription] = useState(row.description)
  const [date, setDate] = useState(row.date)
  const [paymentMethod, setPaymentMethod] = useState<string>(row.paymentMethod)
  const [investment, setInvestment] = useState<string>(
    row.investmentId ? String(row.investmentId) : '',
  )
  const [expenseCategory, setExpenseCategory] = useState<string>(
    row.expenseCategoryId ? String(row.expenseCategoryId) : '',
  )
  const [otherCategory, setOtherCategory] = useState<string>(
    row.otherCategoryId ? String(row.otherCategoryId) : '',
  )
  const [otherDescription, setOtherDescription] = useState(row.otherDescription)
  const [invoiceNote, setInvoiceNote] = useState(row.invoiceNote ?? '')

  function handleOpen() {
    // Reset to current row values
    setDescription(row.description)
    setDate(row.date)
    setPaymentMethod(row.paymentMethod)
    setInvestment(row.investmentId ? String(row.investmentId) : '')
    setExpenseCategory(row.expenseCategoryId ? String(row.expenseCategoryId) : '')
    setOtherCategory(row.otherCategoryId ? String(row.otherCategoryId) : '')
    setOtherDescription(row.otherDescription)
    setInvoiceNote(row.invoiceNote ?? '')
    setOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateTransferAction(row.id, {
        description,
        date,
        paymentMethod: paymentMethod as PaymentMethodT,
        investment: investment ? Number(investment) : undefined,
        expenseCategory: expenseCategory ? Number(expenseCategory) : undefined,
        otherCategory: otherCategory ? Number(otherCategory) : undefined,
        otherDescription: otherDescription || undefined,
        invoiceNote: invoiceNote || undefined,
      })

      if (result.success) {
        toastMessage('Transakcja zaktualizowana', 'success')
        setOpen(false)
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  const editButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleOpen}
      disabled={!canEdit}
      aria-label="Edytuj transakcję"
    >
      <Pencil className="h-4 w-4" />
    </Button>
  )

  return (
    <>
      {canEdit ? (
        editButton
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{editButton}</span>
            </TooltipTrigger>
            <TooltipContent>Możesz edytować tylko swoje transakcje</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader
            title="Edytuj transakcję"
            description={`${TRANSFER_TYPE_LABELS[row.type]} · ${formatPLN(row.amount)}`}
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Opis</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Metoda płatności</label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showsInvestment(row.type) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Inwestycja</label>
                <Select
                  value={investment}
                  onValueChange={setInvestment}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz inwestycję" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData.investments.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>
                        {inv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsExpenseCategory(row.type) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Typ wydatku inwestycyjnego</label>
                <Select
                  value={expenseCategory}
                  onValueChange={setExpenseCategory}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz typ wydatku" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData.expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsOtherCategory(row.type) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategoria</label>
                  <Select
                    value={otherCategory}
                    onValueChange={setOtherCategory}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kategorię" />
                    </SelectTrigger>
                    <SelectContent>
                      {referenceData.otherCategories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Opis kategorii</label>
                  <Textarea
                    value={otherDescription}
                    onChange={(e) => setOtherDescription(e.target.value)}
                    disabled={isPending}
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Notatka</label>
              <Textarea
                value={invoiceNote}
                onChange={(e) => setInvoiceNote(e.target.value)}
                placeholder="Wpisz notatkę..."
                rows={3}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transfers/edit-transfer-button.tsx
git commit -m "feat: create EditTransferButton component with edit dialog"
```

---

### Task 7: Integrate edit button into the transfers table

**Files:**

- Modify: `src/lib/tables/transfers.tsx`
- Modify: `src/components/transfers/transfer-data-table.tsx`
- Modify: `src/components/transfers/transfer-table-server.tsx`

- [ ] **Step 1: Update the actions column in `transfers.tsx`**

The actions column needs reference data and the current user ID. Since the column definitions are static and don't receive props, we need to pass reference data through to the table component. The approach: make `getTransferColumns` accept an options object.

Update the actions column and `getTransferColumns` function. Add new imports at top:

```typescript
import { EditTransferButton } from '@/components/transfers/edit-transfer-button'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import type { ReferenceDataBaseT } from '@/types/reference-data'
```

Note: `ReferenceDataBaseT` is already imported — just add the other two.

Replace the existing `actions` column definition (the `col.display({ id: 'actions', ... })` block) with a placeholder:

```typescript
  col.display({
    id: 'actions',
    header: 'Akcje',
    enableSorting: false,
    cell: () => null, // Placeholder — overridden by getTransferColumns
  }),
```

Then replace the `getTransferColumns` function:

```typescript
type ColumnOptionsT = {
  readonly referenceData?: ReferenceDataBaseT
  readonly currentUserId?: number
  readonly currentUserRole?: RoleT
}

export function getTransferColumns(exclude: string[] = [], options: ColumnOptionsT = {}) {
  const { referenceData, currentUserId, currentUserRole } = options

  const columns = allColumns.map((column) => {
    if (column.id !== 'actions') return column

    return col.display({
      id: 'actions',
      header: 'Akcje',
      enableSorting: false,
      cell: (info) => {
        const row = info.row.original
        if (row.cancelled || isCancellationType(row.type)) return null

        const canEdit =
          !!currentUserRole &&
          (isAdminOrOwnerRole(currentUserRole) || row.createdById === currentUserId)

        return (
          <div className="flex items-center gap-1">
            {referenceData && (
              <EditTransferButton
                row={row}
                referenceData={referenceData}
                canEdit={canEdit}
              />
            )}
            <CancelTransferButton transactionId={row.id} />
          </div>
        )
      },
    })
  })

  if (exclude.length === 0) return columns
  const excludeSet = new Set(exclude)
  return columns.filter((c) => !excludeSet.has(c.id!))
}
```

- [ ] **Step 2: Update `TransferDataTable` to accept and pass column options**

In `src/components/transfers/transfer-data-table.tsx`, update the props type and pass options:

```typescript
import type { RoleT } from '@/lib/auth/roles'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type TransferDataTablePropsT = {
  readonly data: readonly TransferRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly config: TransferTableConfigT
  readonly referenceData?: ReferenceDataBaseT
  readonly currentUserId?: number
  readonly currentUserRole?: RoleT
}

export function TransferDataTable({
  data,
  paginationMeta,
  config,
  referenceData,
  currentUserId,
  currentUserRole,
}: TransferDataTablePropsT) {
  const { baseUrl, excludeColumns = [], filters, headerFields } = config
  const columns = getTransferColumns(excludeColumns, {
    referenceData,
    currentUserId,
    currentUserRole,
  })
  // ... rest unchanged
```

- [ ] **Step 3: Update `TransferTableServer` to pass reference data and user info**

In `src/components/transfers/transfer-table-server.tsx`:

```typescript
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'

export async function TransferTableServer({ config }: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = config.excludeColumns?.includes('invoice') ?? false

  const [rawTxResult, refData, { user }] = await Promise.all([
    findTransfersRaw(config.query),
    fetchReferenceData(),
    requireAuth(MANAGEMENT_ROLES),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={config}
      referenceData={refData}
      currentUserId={user?.id}
      currentUserRole={user?.role}
    />
  )
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All pass (update test fixtures if needed for new `TransferRowT` fields)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tables/transfers.tsx src/components/transfers/transfer-data-table.tsx src/components/transfers/transfer-table-server.tsx
git commit -m "feat: integrate edit button into transfers table with permission check"
```

- [ ] **Step 7: Run /simplify**

Review the UI integration for code quality.

---

## Chunk 4: Remove Inline Note Editing

### Task 8: Remove inline note editing and clean up `updateTransferNoteAction`

**Files:**

- Modify: `src/components/dialogs/note-dialog.tsx`
- Modify: `src/lib/actions/transfers.ts`
- Modify: `src/__tests__/transfer-actions.test.ts`
- Modify: `src/lib/tables/transfers.tsx`

- [ ] **Step 1: Replace interactive NoteCell with display-only version**

Replace the entire file content:

```typescript
import { MessageSquareText } from 'lucide-react'

type NoteCellPropsT = {
  readonly note: string | null
}

export function NoteCell({ note }: NoteCellPropsT) {
  if (!note) return null

  return (
    <span className="flex items-center gap-1 text-sm" title={note}>
      <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{note}</span>
    </span>
  )
}
```

- [ ] **Step 2: Update NoteCell usage in transfers.tsx**

In `src/lib/tables/transfers.tsx`, update the `invoiceNote` column. The `NoteCell` no longer needs `transactionId`:

```typescript
  col.accessor('invoiceNote', {
    id: 'invoiceNote',
    header: 'Notatka',
    enableSorting: false,
    cell: (info) => <NoteCell note={info.getValue()} />,
  }),
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors. If anything still references `updateTransferNoteAction`, fix those imports.

- [ ] **Step 4: Remove `updateTransferNoteAction` from server actions**

Delete the `updateTransferNoteAction` function from `src/lib/actions/transfers.ts` (the function body and export).

- [ ] **Step 5: Remove `updateTransferNoteAction` tests**

In `src/__tests__/transfer-actions.test.ts`:

- Remove `updateTransferNoteAction` from the dynamic import
- Delete the entire `describe('updateTransferNoteAction', ...)` test block

- [ ] **Step 6: Verify no remaining references**

Run: `grep -r "updateTransferNoteAction" src/`
Expected: No results

- [ ] **Step 7: Run all tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/components/dialogs/note-dialog.tsx src/lib/tables/transfers.tsx src/lib/actions/transfers.ts src/__tests__/transfer-actions.test.ts
git commit -m "refactor: remove inline note editing and updateTransferNoteAction"
```

- [ ] **Step 9: Run /simplify**

Final review of all changes for code quality.

---

## Chunk 5: Verification

### Task 9: Manual verification and final checks

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 4: Run formatter**

Run: `pnpm format:fix`
Expected: Files formatted

- [ ] **Step 5: Run dev server and test manually**

Run: `pnpm dev`

Manual test checklist:

1. Navigate to a transfer table (e.g., `/kasa/[id]`)
2. Verify edit (pencil) button appears in actions column next to cancel button
3. Verify edit button is hidden for cancelled rows and CANCELLATION rows
4. Verify edit button is disabled with tooltip for transactions created by other users (if testing as MANAGER)
5. Click edit button → dialog opens with pre-filled values
6. Verify conditional fields show/hide based on type (e.g., investment only for INVESTMENT_EXPENSE)
7. Edit a field (e.g., description) → save → verify the table updates
8. Verify note column shows display-only text (no edit icon)
9. Verify cancellation still works

- [ ] **Step 6: Final commit if any formatting changes**

```bash
git add -A
git commit -m "chore: formatting and final verification"
```
