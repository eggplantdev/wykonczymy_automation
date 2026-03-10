# Merge Settlement into Transfer Dialog — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the settlement dialog into the transfer dialog so all expenses (including worker settlements) go through one form.

**Architecture:** The transfer form gains per-line-item categories, per-line-item notes, saldo display, and WORKER register access. The settlement form/action/schema are deleted. The register transfer form allows WORKER registers as source.

**Tech Stack:** Zod 4, TanStack Form, Next.js server actions, Vitest

**Spec:** `docs/plans/2026-03-10-merge-settlement-into-transfer.md`

---

## Chunk 1: Schema + Action Changes

### Task 1: Add per-line-item category/note to bulk transfer schema

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-schema.ts:119-184`

- [ ] **Step 1: Write failing tests for new line item fields**

Add to `src/__tests__/transfer-schema.test.ts`:

```ts
// After the existing "createTransferSchema — amount edge cases" describe block

describe('createBulkTransferSchema — per-line-item category', () => {
  const bulkBase = {
    date: '2026-02-25',
    type: 'OTHER' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
  }

  it('OTHER with per-line category → passes', () => {
    const result = createBulkTransferSchema.safeParse({
      ...bulkBase,
      lineItems: [{ description: 'Item', amount: 100, category: 5 }],
    })
    expect(result.success).toBe(true)
  })

  it('OTHER without per-line category → fails on lineItems.0.category', () => {
    const result = createBulkTransferSchema.safeParse({
      ...bulkBase,
      lineItems: [{ description: 'Item', amount: 100 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('lineItems.0.category')
    }
  })

  it('INVESTMENT_EXPENSE with optional per-line category → passes', () => {
    const result = createBulkTransferSchema.safeParse({
      ...bulkBase,
      type: 'INVESTMENT_EXPENSE',
      investment: 1,
      expenseCategory: 1,
      lineItems: [{ description: 'Item', amount: 100, category: 3 }],
    })
    expect(result.success).toBe(true)
  })

  it('PAYOUT without per-line category → passes (optional)', () => {
    const result = createBulkTransferSchema.safeParse({
      ...bulkBase,
      type: 'PAYOUT',
      lineItems: [{ description: 'Item', amount: 100 }],
    })
    expect(result.success).toBe(true)
  })

  it('line item with note → passes', () => {
    const result = createBulkTransferSchema.safeParse({
      ...bulkBase,
      lineItems: [{ description: 'Item', amount: 100, category: 5, note: 'Test note' }],
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/transfer-schema.test.ts`
Expected: New tests fail (category not in schema, no per-line validation)

- [ ] **Step 3: Update bulk transfer schemas**

In `src/components/forms/transfer-form/transfer-schema.ts`:

1. Add `category` and `note` to `lineItemClientSchema`:

```ts
const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
  invoiceNote: z.string(),
  category: z.string().optional().default(''),
  note: z.string().optional().default(''),
})
```

2. Add `category` and `note` to `createBulkTransferSchema` line item:

```ts
lineItems: z
  .array(
    z.object({
      description: z.string(),
      amount: z.number().positive('Kwota musi być większa niż 0'),
      invoiceNote: z.string().optional(),
      category: z.number().positive().optional(),
      note: z.string().optional(),
    }),
  )
  .min(1, 'Dodaj co najmniej jedną pozycję'),
```

3. Add per-line category validation in `bulkTransferFormSchema` superRefine (after existing line item amount validation):

```ts
if (data.type === 'OTHER') {
  data.lineItems.forEach((item, index) => {
    if (!item.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kategoria jest wymagana dla typu "Inny wydatek"',
        path: ['lineItems', index, 'category'],
      })
    }
  })
}
```

4. Add same validation in `createBulkTransferSchema` superRefine (after `validateTransferFields`):

```ts
.superRefine((data, ctx) => {
  validateTransferFields(data, ctx)

  if (data.type === 'OTHER') {
    data.lineItems.forEach((item, index) => {
      if (!item.category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kategoria jest wymagana dla typu "Inny wydatek"',
          path: ['lineItems', index, 'category'],
        })
      }
    })
  }
})
```

5. Remove `otherCategory` and `otherDescription` from `bulkTransferFormSchema` and `createBulkTransferSchema` top-level fields. Keep them in the single-transfer schemas (`createTransferSchema`, `transferFormSchema`) — those are used by the Payload admin and cancellation flows.

**Important:** Do NOT remove the `otherCategory` rule from the shared `transferFieldRules` array — it is still needed by the single-transfer schema (`createTransferSchema`). The bulk schemas no longer pass through `otherCategory` at top level, so the shared rule won't fire for them (no top-level `otherCategory` field = falsy = rule triggers but bulk has its own per-line validation). To avoid false positives, wrap the existing `otherCategory` rule to only fire when `otherCategory` is a defined field on the data object:

```ts
{
  invalid: (d) => d.type === 'OTHER' && 'otherCategory' in d && !d.otherCategory,
  message: 'Kategoria jest wymagana dla transferu typu "Inny wydatek"',
  path: 'otherCategory',
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/transfer-schema.test.ts`
Expected: All tests pass. Some existing tests for top-level `otherCategory` in bulk schema may need updating — remove or adapt them.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/transfer-form/transfer-schema.ts src/__tests__/transfer-schema.test.ts
git commit -m "feat: add per-line-item category and note to bulk transfer schema"
```

---

### Task 2: Update bulk transfer action to use per-line-item category

**Files:**

- Modify: `src/lib/actions/transfers.ts:91-114`
- Test: `src/__tests__/transfer-actions.test.ts`

- [ ] **Step 1: Write failing test for per-line category in bulk action**

Add to `src/__tests__/transfer-actions.test.ts` inside `createBulkTransferAction` describe:

```ts
it('OTHER type → each create gets its own category and note from line item', async () => {
  mockUploadBulkInvoices.mockResolvedValueOnce([undefined, undefined])

  const data = {
    type: 'OTHER' as const,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    lineItems: [
      { description: 'Item 1', amount: 100, category: 5, note: 'Note A' },
      { description: 'Item 2', amount: 200, category: 7, note: 'Note B' },
    ],
  }

  const result = await createBulkTransferAction(data, null)

  expect(result.success).toBe(true)
  expect(mockCreate).toHaveBeenCalledTimes(2)
  expect(mockCreate.mock.calls[0][0].data).toEqual(
    expect.objectContaining({ otherCategory: 5, otherDescription: 'Note A' }),
  )
  expect(mockCreate.mock.calls[1][0].data).toEqual(
    expect.objectContaining({ otherCategory: 7, otherDescription: 'Note B' }),
  )
})

it('INVESTMENT_EXPENSE with optional per-line category → passes through', async () => {
  mockUploadBulkInvoices.mockResolvedValueOnce([undefined])

  const data = {
    ...makeBulkTransferData(1),
    lineItems: [{ description: 'Item', amount: 100, category: 3, note: 'Extra' }],
  }

  const result = await createBulkTransferAction(data, null)

  expect(result.success).toBe(true)
  expect(mockCreate.mock.calls[0][0].data).toEqual(
    expect.objectContaining({ otherCategory: 3, otherDescription: 'Extra' }),
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/transfer-actions.test.ts`
Expected: Fails — action currently reads `otherCategory` from top-level, not per item.

- [ ] **Step 3: Update action to use per-line-item fields**

In `src/lib/actions/transfers.ts`, inside `createBulkTransferAction`, change the per-item create data (lines ~97-113):

```ts
for (let i = 0; i < parsed.data.lineItems.length; i++) {
  const item = parsed.data.lineItems[i]
  await payload.create({
    collection: 'transactions',
    req,
    data: {
      description: item.description,
      amount: item.amount,
      date: parsed.data.date,
      type: parsed.data.type,
      paymentMethod: parsed.data.paymentMethod,
      sourceRegister: parsed.data.sourceRegister,
      targetRegister: parsed.data.targetRegister,
      investment: parsed.data.investment,
      expenseCategory: parsed.data.expenseCategory,
      otherCategory: item.category,
      otherDescription: item.note,
      invoice: mediaIds[i],
      invoiceNote: item.invoiceNote,
      createdBy: user.id,
    },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/transfer-actions.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/transfers.ts src/__tests__/transfer-actions.test.ts
git commit -m "feat: bulk transfer action uses per-line-item category and note"
```

---

### Task 3: Move getRegisterSaldo to transfers action

**Files:**

- Modify: `src/lib/actions/transfers.ts` (add function)

- [ ] **Step 1: Copy `getRegisterSaldo` to transfers.ts**

Add new imports at the top of `src/lib/actions/transfers.ts`:

```ts
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
```

Add the function at end of file:

```ts
export async function getRegisterSaldo(registerId: number): Promise<{ saldo: number }> {
  const step = perfStart()

  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Brak uprawnień')
  console.log(`[PERF]   requireAuth ${step()}ms`)

  const payload = await getPayload({ config })
  console.log(`[PERF]   getPayload ${step()}ms`)

  const saldo = await sumRegisterBalance(payload, registerId)
  console.log(`[PERF] getRegisterSaldo(${registerId}) saldo=${saldo} ${step()}ms`)

  return { saldo }
}
```

**Note:** `getManagementEmployeeSaldo` in `settlements.ts` is dead code — it is not imported anywhere outside the settlement test file. It will be deleted with the settlement files in Task 8. Do NOT move it.

- [ ] **Step 2: Run full test suite to verify nothing broke**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "refactor: move getRegisterSaldo to transfers action"
```

---

## Chunk 2: Transfer Form UI Changes

### Task 4: Add saldo display to transfer form

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx`

- [ ] **Step 1: Add saldo state and fetch function**

Add imports at top of `transfer-form.tsx`:

```ts
import { useState } from 'react'
import { getRegisterSaldo } from '@/lib/actions/transfers'
import { formatPLN } from '@/lib/format-currency'
```

Add state inside `TransferForm` component (after `isSourceRestricted`):

```ts
const [saldo, setSaldo] = useState<number | null>(null)
const [isSaldoLoading, setIsSaldoLoading] = useState(false)

async function fetchSaldo(registerId: string) {
  setSaldo(null)
  if (!registerId) return

  setIsSaldoLoading(true)
  try {
    const result = await getRegisterSaldo(Number(registerId))
    setSaldo(result.saldo)
  } catch {
    toastMessage('Nie udało się pobrać salda', 'error')
  } finally {
    setIsSaldoLoading(false)
  }
}
```

- [ ] **Step 2: Add onChange listener to source register field**

Add a `listeners` prop to the existing `CashRegisterField` for source register (the `excludeTypes` prop is still present at this point — it gets removed in Task 5):

```tsx
listeners={{
  onChange: ({ value }: { value: string }) => {
    fetchSaldo(value)
  },
}}
```

- [ ] **Step 3: Add saldo display and summary**

After the source register field, add:

```tsx
{
  isSaldoLoading && <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
}
{
  saldo !== null && !isSaldoLoading && (
    <p className="text-sm">
      Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
    </p>
  )
}
```

Before `FormFooter`, add summary (only when saldo is loaded):

```tsx
{
  saldo !== null && (
    <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
      <p className="text-sm">
        Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
      </p>
      <p className="text-sm">
        Suma wydatków: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <p className="text-sm">
        Saldo po transakcji: <span className="font-medium">{formatPLN(saldo - total)}</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Reset saldo when type changes**

Add `setSaldo(null)` inside `resetConditionalFields()`:

```ts
function resetConditionalFields() {
  conditionalFields.forEach((field) => form.resetField(field))
  if (!isSourceRestricted || (userCashRegisterIds && userCashRegisterIds.length > 1))
    form.resetField('sourceRegister')
  setSaldo(null)
}
```

- [ ] **Step 5: Verify in browser**

Run: `pnpm dev`
Open the transfer dialog, select a source register, verify saldo appears.

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/transfer-form/transfer-form.tsx
git commit -m "feat: show register saldo in transfer dialog"
```

---

### Task 5: Remove WORKER exclusion from source registers

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx:211-218`
- Modify: `src/components/forms/register-transfer-form/register-transfer-form.tsx:117-123`

- [ ] **Step 1: Remove `excludeTypes` from transfer form source register**

In `src/components/forms/transfer-form/transfer-form.tsx`, change:

```tsx
<CashRegisterField
  form={form}
  cashRegisters={referenceData.cashRegisters}
  userCashRegisterIds={userCashRegisterIds}
  excludeTypes={['WORKER']}
```

to:

```tsx
<CashRegisterField
  form={form}
  cashRegisters={referenceData.cashRegisters}
  userCashRegisterIds={userCashRegisterIds}
```

- [ ] **Step 2: Remove `excludeTypes` from register transfer form source register**

In `src/components/forms/register-transfer-form/register-transfer-form.tsx`, change:

```tsx
<CashRegisterField
  form={form}
  label="Kasa źródłowa"
  cashRegisters={referenceData.cashRegisters}
  userCashRegisterIds={userCashRegisterIds}
  excludeTypes={['WORKER']}
/>
```

to:

```tsx
<CashRegisterField
  form={form}
  label="Kasa źródłowa"
  cashRegisters={referenceData.cashRegisters}
  userCashRegisterIds={userCashRegisterIds}
/>
```

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev`
Verify WORKER registers appear in both source register dropdowns.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/transfer-form/transfer-form.tsx src/components/forms/register-transfer-form/register-transfer-form.tsx
git commit -m "feat: allow WORKER registers as source in transfer and register transfer forms"
```

---

### Task 6: Add per-line-item category and note fields to transfer form

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx`

- [ ] **Step 1: Add category/note to FormValuesT and defaults**

Update `FormValuesT`:

```ts
type FormValuesT = {
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
  investment: string
  expenseCategory: string
  lineItems: {
    description: string
    amount: string
    invoiceNote: string
    category: string
    note: string
  }[]
}
```

Remove `otherCategory` and `otherDescription` from `FormValuesT`, defaults, `conditionalFields`, and the `onSubmit` data mapping.

Update default line item:

```ts
lineItems: [{ description: '', amount: '', invoiceNote: '', category: '', note: '' }],
```

- [ ] **Step 2: Update onSubmit to pass per-line-item fields**

In `onSubmit`, update `lineItems` mapping:

```ts
lineItems: value.lineItems.map((item) => ({
  description: item.description,
  amount: Number(item.amount),
  invoiceNote: item.invoiceNote || undefined,
  category: item.category ? Number(item.category) : undefined,
  note: item.note || undefined,
})),
```

Remove `otherCategory` and `otherDescription` from the top-level `data` object.

- [ ] **Step 3: Remove top-level OTHER category UI**

Remove the `needsOtherCategory(currentType)` conditional block (the `otherCategory` select and `otherDescription` textarea — roughly lines 188-208).

- [ ] **Step 4: Add per-line-item category and note inside `renderItemExtras`**

Update the `LineItemsField` to include category/note per line item. Replace the existing `renderItemExtras`:

```tsx
<LineItemsField
  form={form}
  emptyItem={{ description: '', amount: '', invoiceNote: '', category: '', note: '' }}
  total={total}
  onRemoveItem={handleRemoveLineItem}
  onFileChange={handleFileChange}
  renderItemExtras={(index) => (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        <form.AppField name={`lineItems[${index}].category`}>
          {(field: {
            Select: React.FC<{
              label: string
              placeholder: string
              showError: boolean
              children: React.ReactNode
            }>
          }) => (
            <field.Select
              label={currentType === 'OTHER' ? 'Kategoria *' : 'Kategoria'}
              placeholder="Wybierz kategorię"
              showError
            >
              {referenceData.otherCategories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
        <form.AppField name={`lineItems[${index}].note`}>
          {(field: {
            Input: React.FC<{
              label: string
              placeholder: string
              showError: boolean
            }>
          }) => <field.Input label="Notatka" placeholder="Notatka do pozycji" showError />}
        </form.AppField>
      </div>
      <form.AppField name={`lineItems[${index}].invoiceNote`}>
        {(field: {
          Textarea: React.FC<{
            placeholder: string
            showError: boolean
            className: string
          }>
        }) => (
          <field.Textarea
            placeholder="Notatka do faktury (opcjonalnie)"
            showError
            className="min-h-6"
          />
        )}
      </form.AppField>
    </>
  )}
/>
```

- [ ] **Step 5: Verify in browser**

Run: `pnpm dev`

- Open transfer dialog, select OTHER → verify category is shown per line item
- Select INVESTMENT_EXPENSE → verify category still shows but is optional
- Select PAYOUT → verify category shows but is optional

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/transfer-form/transfer-form.tsx
git commit -m "feat: per-line-item category and note in transfer form"
```

---

## Chunk 3: Delete Settlement + Cleanup

### Task 7: Remove settlement dialog from navigation

**Files:**

- Modify: `src/components/nav/top-nav.tsx:5,30`

- [ ] **Step 1: Remove settlement import and usage**

Remove line 5: `import { AddSettlementDialog } from '@/components/dialogs/add-settlement-dialog'`

Remove line 30: `<AddSettlementDialog referenceData={referenceData} />`

- [ ] **Step 2: Verify in browser**

Run: `pnpm dev`
Verify settlement button is gone from the nav.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/top-nav.tsx
git commit -m "feat: remove settlement dialog from navigation"
```

---

### Task 8: Delete settlement files

**Files:**

- Delete: `src/components/forms/settlement-form/settlement-form.tsx`
- Delete: `src/components/forms/settlement-form/settlement-schema.ts`
- Delete: `src/components/dialogs/add-settlement-dialog.tsx`
- Delete: `src/lib/actions/settlements.ts`
- Delete: `src/__tests__/settlement-actions.test.ts`
- Delete: `src/__tests__/settlement-schema.test.ts`

- [ ] **Step 1: Delete settlement form, schema, dialog, action**

```bash
rm src/components/forms/settlement-form/settlement-form.tsx
rm src/components/forms/settlement-form/settlement-schema.ts
rm src/components/dialogs/add-settlement-dialog.tsx
rm src/lib/actions/settlements.ts
```

- [ ] **Step 2: Delete settlement test files**

```bash
rm src/__tests__/settlement-actions.test.ts
rm src/__tests__/settlement-schema.test.ts
```

- [ ] **Step 3: Check for remaining settlement imports**

```bash
grep -r "settlement" src/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining imports. Key files to check:

- `src/__tests__/bulk-transaction.test.ts` — imports `createSettlementAction`, needs updating
- `src/__tests__/optimistic-form-store.test.ts` — uses form ID `'settlement'`, change to `'transfer'`

- [ ] **Step 4: Update bulk-transaction.test.ts**

This test imports `createSettlementAction` and has a `makeSettlementData()` helper. Remove the settlement-specific section entirely — the bulk transfer section in `transfer-actions.test.ts` already covers transaction commit/rollback behavior. Remove the `createSettlementAction` import and `makeSettlementData` helper, and delete settlement test cases.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: delete settlement form, schema, action, dialog, and tests"
```

---

### Task 9: Clean up unused constants

**Files:**

- Modify: `src/lib/constants/transfers.ts`

- [ ] **Step 1: Check if `needsOtherCategory` is still used**

After removing the top-level OTHER category UI from the transfer form, check if `needsOtherCategory` is referenced anywhere else (Payload admin, hooks, etc.).

If only used by the deleted transfer form conditional → remove it from constants.

- [ ] **Step 2: Remove if unused**

Remove from `src/lib/constants/transfers.ts`:

```ts
export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'
```

- [ ] **Step 3: Run full test suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants/transfers.ts
git commit -m "refactor: remove unused needsOtherCategory helper"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 4: Manual browser verification**

Run: `pnpm dev`

Verify:

1. Transfer dialog ("Nowy wydatek") opens with all 4 expense types
2. Selecting a source register shows saldo
3. OTHER type requires per-line-item category
4. INVESTMENT_EXPENSE shows optional per-line category + required top-level expenseCategory
5. PAYOUT and LABOR_COST show optional per-line category
6. WORKER registers appear in source register dropdown
7. Register transfer dialog allows WORKER registers as source
8. Settlement dialog button is gone from nav
9. Existing transfers display correctly in the table

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: final adjustments from manual verification"
```
