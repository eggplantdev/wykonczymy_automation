# Bulk Transactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the single-transaction transfer form into an always-bulk form where shared fields (type, register, investment, etc.) are set once and multiple line items (description, amount, invoice) can be added.

**Architecture:** The transfer form switches from flat description/amount/invoice fields to a `lineItems` array using TanStack Form's `mode="array"` — same pattern as the settlement form. A new `createBulkTransferAction` handles parallel file uploads, parallel transaction creation with `skipBalanceRecalc`, and deferred recalc at the end.

**Tech Stack:** TanStack Form, Zod, Payload CMS, Next.js Server Actions

---

### Task 1: Add bulk schemas to transfer-schema.ts

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-schema.ts`

**Step 1: Add bulk client schema**

After the existing `transferFormSchema` (line 118), add the new bulk schemas. The existing schemas stay untouched.

Add this code after line 118:

```typescript
// ---------------------------------------------------------------------------
// Bulk transfer schemas (line-items pattern)
// ---------------------------------------------------------------------------

const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
  invoiceNote: z.string(),
})

export const bulkTransferFormSchema = z
  .object({
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    sourceRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
    worker: z.string(),
    otherCategory: z.string(),
    otherDescription: z.string(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    refineDate(data, ctx)
    validateTransferFields(data, ctx)

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opis jest wymagany',
          path: ['lineItems', index, 'description'],
        })
      }
      if (!item.amount || Number(item.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
      }
    })
  })

export const createBulkTransferSchema = z
  .object({
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string().min(1, 'Opis jest wymagany'),
          amount: z.number().positive('Kwota musi być większa niż 0'),
          invoiceNote: z.string().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => validateTransferFields(data, ctx))

export type CreateBulkTransferFormT = z.infer<typeof createBulkTransferSchema>
```

**Step 2: Verify the file compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors in `transfer-schema.ts`

**Step 3: Commit**

```bash
git add src/components/forms/transfer-form/transfer-schema.ts
git commit -m "feat: add bulk transfer schemas (client + server)"
```

---

### Task 2: Add createBulkTransferAction server action

**Files:**

- Modify: `src/lib/actions/transfers.ts`

**Step 1: Add imports and the new action**

Add these imports at the top of the file (alongside existing imports):

```typescript
import {
  createBulkTransferSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  getDb,
  sumRegisterBalance,
  sumInvestmentCosts,
  sumInvestmentIncome,
} from '@/lib/db/sum-transfers'
import { INVESTMENT_TYPES, needsSourceRegister } from '../constants/transfers'
```

Then add the new action before the `updateTransferNoteAction` function (before line 78):

```typescript
export async function createBulkTransferAction(
  data: CreateBulkTransferFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  const lineCount = data.lineItems.length
  console.log(`[PERF] createBulkTransferAction START type=${data.type} lineItems=${lineCount}`)

  const session = await perf('bulkTransfer.requireAuth', () => requireAuth(MANAGEMENT_ROLES))
  if (!session.success) return session
  const { user } = session

  const parsed = validateAction(createBulkTransferSchema, data)
  if (!parsed.success) return parsed

  try {
    const payload = await perf('bulkTransfer.getPayload', () => getPayload({ config }))

    // Validate source register + balance check (sum of all line items)
    if (needsSourceRegister(parsed.data.type)) {
      const validated = await validateSourceRegister(parsed.data.sourceRegister, user)
      if (!validated.success) return validated

      const totalAmount = parsed.data.lineItems.reduce((sum, item) => sum + item.amount, 0)
      const balanceCheck = await checkIfSufficientBalance(validated.register, totalAmount, payload)
      if (!balanceCheck.success) return balanceCheck
    }

    // Upload invoice files in parallel
    const mediaIds = await perf(`bulkTransfer.uploadMedia (${lineCount} items)`, () =>
      Promise.all(
        parsed.data.lineItems.map(async (_, i) => {
          const file = invoiceFormData?.get(`invoice-${i}`) as File | null
          if (file && file.size > 0) return uploadInvoiceFile(payload, file)
          return undefined
        }),
      ),
    )

    // Create all transactions in parallel with deferred recalc
    const created = await perf(`bulkTransfer.createTransactions (${lineCount} items)`, async () => {
      const results = await Promise.all(
        parsed.data.lineItems.map((item, i) =>
          payload.create({
            collection: 'transactions',
            data: {
              description: item.description,
              amount: item.amount,
              date: parsed.data.date,
              type: parsed.data.type,
              paymentMethod: parsed.data.paymentMethod,
              sourceRegister: parsed.data.sourceRegister,
              targetRegister: parsed.data.targetRegister,
              investment: parsed.data.investment,
              worker: parsed.data.worker,
              otherCategory: parsed.data.otherCategory,
              otherDescription: parsed.data.otherDescription,
              invoice: mediaIds[i],
              invoiceNote: item.invoiceNote,
              createdBy: user.id,
            },
            context: { skipBalanceRecalc: true },
          }),
        ),
      )
      return results.length
    })

    // Deferred recalc — register balance + investment financials
    await perf('bulkTransfer.recalcBalances', async () => {
      const db = await getDb(payload)

      if (parsed.data.sourceRegister && needsSourceRegister(parsed.data.type)) {
        const balance = await sumRegisterBalance(payload, parsed.data.sourceRegister)
        await db.execute(sql`
          UPDATE cash_registers SET balance = ${balance}, updated_at = NOW()
          WHERE id = ${parsed.data.sourceRegister}
        `)
      }

      if (parsed.data.targetRegister) {
        const balance = await sumRegisterBalance(payload, parsed.data.targetRegister)
        await db.execute(sql`
          UPDATE cash_registers SET balance = ${balance}, updated_at = NOW()
          WHERE id = ${parsed.data.targetRegister}
        `)
      }

      if (
        parsed.data.investment &&
        (INVESTMENT_TYPES as readonly string[]).includes(parsed.data.type)
      ) {
        const [totalCosts, totalIncome] = await Promise.all([
          sumInvestmentCosts(payload, parsed.data.investment),
          sumInvestmentIncome(payload, parsed.data.investment),
        ])
        await db.execute(sql`
          UPDATE investments
          SET total_costs = ${totalCosts}, total_income = ${totalIncome}, updated_at = NOW()
          WHERE id = ${parsed.data.investment}
        `)
      }
    })

    revalidateCollections(['transfers', 'cashRegisters', 'investments'])

    console.log(`[PERF] createBulkTransferAction TOTAL ${elapsed()}ms (${created} transactions)`)

    return { success: true }
  } catch (err) {
    console.log('[createBulkTransferAction] Error:', getErrorMessage(err))
    return { success: false, error: getErrorMessage(err) }
  }
}
```

**Step 2: Verify the file compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors in `transfers.ts`

**Step 3: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "feat: add createBulkTransferAction with parallel create + deferred recalc"
```

---

### Task 3: Convert TransferForm to line-items UI

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx`

This is the largest change. The form switches from flat description/amount/invoiceRef/invoiceNote to a `lineItems` array with per-item description, amount, invoice file (via Map ref), and invoiceNote.

**Step 1: Rewrite transfer-form.tsx**

Replace the entire file contents. Key changes from the current version:

- `FormValuesT`: Remove flat `description`, `amount`, `invoiceNote`. Add `lineItems` array.
- `invoiceRef` (single HTMLInputElement) → `invoiceFilesRef` (Map<number, File>)
- Import `createBulkTransferAction` instead of `createTransferAction`
- Import `bulkTransferFormSchema` instead of `transferFormSchema`
- Import `CreateBulkTransferFormT` instead of `CreateTransferFormT`
- Add `X` icon from lucide-react and `Button` from ui
- Add `formatPLN` for running total
- `onSubmit`: Build `CreateBulkTransferFormT` from shared fields + lineItems, pack invoice files into FormData keyed `invoice-{index}`
- Render: After shared conditional fields, render a `form.Field name="lineItems" mode="array"` block (same pattern as settlement-form.tsx lines 267-349)
- Each line item row: description input + amount input (w-36) + file input + invoiceNote textarea + remove button
- "Dodaj pozycję" button below
- Running total below that
- Remove the old flat `<DescriptionField>`, `<AmountField>`, single `<FileInput>`, and `invoiceNote` field

Full replacement:

```tsx
'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { FileInput } from '@/components/ui/file-input'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import {
  bulkTransferFormSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister, getUserCashRegisterIds } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import { CashRegisterField, InvestmentField, WorkerField } from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
}

type FormValuesT = {
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
  investment: string
  worker: string
  otherCategory: string
  otherDescription: string
  lineItems: { description: string; amount: string; invoiceNote: string }[]
}

export function TransferForm({ referenceData, onSuccess }: TransferFormPropsT) {
  const invoiceFilesRef = useRef<Map<number, File>>(new Map())
  const userCashRegisterIds = getUserCashRegisterIds(referenceData)
  const isSourceRestricted = userCashRegisterIds !== undefined
  const [expenseTarget, setExpenseTarget] = useState<'investment' | 'other'>('investment')

  const form = useAppForm({
    defaultValues: {
      date: today(),
      type: 'INVESTMENT_EXPENSE',
      paymentMethod: 'CASH',
      sourceRegister: getDefaultCashRegister(referenceData),
      targetRegister: '',
      investment: '',
      worker: '',
      otherCategory: '',
      otherDescription: '',
      lineItems: [{ description: '', amount: '', invoiceNote: '' }],
    } as FormValuesT,
    validators: {
      onSubmit: bulkTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateBulkTransferFormT = {
        date: value.date,
        type: value.type as TransferTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        otherDescription: value.otherDescription || undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          invoiceNote: item.invoiceNote || undefined,
        })),
      }

      let invoiceFormData: FormData | null = null
      if (invoiceFilesRef.current.size > 0) {
        invoiceFormData = new FormData()
        invoiceFilesRef.current.forEach((file, index) => {
          invoiceFormData!.set(`invoice-${index}`, file)
        })
      }

      const result = await createBulkTransferAction(data, invoiceFormData)

      if (result.success) {
        toastMessage('Transakcje dodane', 'success')
        onSuccess()
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment, worker) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = [
    'targetRegister',
    'investment',
    'worker',
    'otherCategory',
    'otherDescription',
  ] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    if (!isSourceRestricted || (userCashRegisterIds && userCashRegisterIds.length > 1))
      form.resetField('sourceRegister')
    setExpenseTarget('investment')
  }

  function handleRemoveLineItem(index: number, removeValue: (index: number) => void) {
    const oldFiles = invoiceFilesRef.current
    const newFiles = new Map<number, File>()
    oldFiles.forEach((file, i) => {
      if (i < index) newFiles.set(i, file)
      else if (i > index) newFiles.set(i - 1, file)
    })
    invoiceFilesRef.current = newFiles
    removeValue(index)
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) invoiceFilesRef.current.set(index, file)
    else invoiceFilesRef.current.delete(index)
  }

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          {/* Type — deposit types moved to separate deposit dialog */}
          <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
            {(field) => (
              <field.Select label="Typ transferu" showError>
                {TRANSACTION_TRANSFER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Radio toggle for EMPLOYEE_EXPENSE: investment vs other category */}
          {currentType === 'EMPLOYEE_EXPENSE' && (
            <fieldset className="space-y-2">
              <legend className="text-foreground text-sm font-medium">Cel wydatku</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="expenseTarget"
                    value="investment"
                    checked={expenseTarget === 'investment'}
                    onChange={() => {
                      setExpenseTarget('investment')
                      form.resetField('otherCategory')
                      form.resetField('otherDescription')
                    }}
                    className="accent-primary size-4"
                  />
                  Inwestycja
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="expenseTarget"
                    value="other"
                    checked={expenseTarget === 'other'}
                    onChange={() => {
                      setExpenseTarget('other')
                      form.resetField('investment')
                    }}
                    className="accent-primary size-4"
                  />
                  Inna kategoria
                </label>
              </div>
            </fieldset>
          )}

          {/* Conditional: Other category — always for OTHER, radio-gated for EMPLOYEE_EXPENSE */}
          {needsOtherCategory(currentType) &&
            (currentType === 'OTHER' || expenseTarget === 'other') && (
              <>
                <form.AppField name="otherCategory">
                  {(field) => (
                    <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                      {referenceData.otherCategories
                        .toSorted((a, b) => a.name.localeCompare(b.name, 'pl'))
                        .map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </field.Select>
                  )}
                </form.AppField>

                <form.AppField name="otherDescription">
                  {(field) => (
                    <field.Textarea label="Opis kategorii" placeholder="Dodatkowy opis" showError />
                  )}
                </form.AppField>
              </>
            )}

          {/* Cash register — hidden for EMPLOYEE_EXPENSE, filtered to owned registers for non-ADMIN */}
          {needsSourceRegister(currentType) && (
            <CashRegisterField
              form={form}
              cashRegisters={referenceData.cashRegisters}
              userCashRegisterIds={userCashRegisterIds}
            />
          )}

          {/* Conditional: Target register (REGISTER_TRANSFER only) */}
          {needsTargetRegister(currentType) && (
            <CashRegisterField
              form={form}
              name="targetRegister"
              label="Kasa docelowa"
              placeholder="Wybierz kasę docelową"
              cashRegisters={referenceData.cashRegisters}
            />
          )}

          {/* Conditional: Investment — radio-gated for EMPLOYEE_EXPENSE */}
          {showsInvestment(currentType) &&
            (currentType !== 'EMPLOYEE_EXPENSE' || expenseTarget === 'investment') && (
              <InvestmentField form={form} investments={referenceData.investments} />
            )}

          {/* Conditional: Worker */}
          {needsWorker(currentType) && <WorkerField form={form} workers={referenceData.workers} />}

          {/* Line items */}
          {!isDepositType(currentType) && (
            <form.Field name="lineItems" mode="array">
              {(lineItemsField) => (
                <div className="space-y-4">
                  <p className="text-foreground text-sm font-medium">Pozycje</p>
                  {lineItemsField.state.value.map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <form.AppField name={`lineItems[${index}].description`}>
                            {(field) => <field.Input placeholder="Opis pozycji" showError />}
                          </form.AppField>
                        </div>
                        <div className="w-36">
                          <form.AppField name={`lineItems[${index}].amount`}>
                            {(field) => <field.Input placeholder="Kwota" type="number" showError />}
                          </form.AppField>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(index, lineItemsField.removeValue)}
                          disabled={lineItemsField.state.value.length === 1}
                          aria-label="Usuń pozycję"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {currentType !== 'ACCOUNT_FUNDING' && (
                        <>
                          <FileInput
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileChange(index, e)}
                          />
                          <form.AppField name={`lineItems[${index}].invoiceNote`}>
                            {(field) => (
                              <field.Textarea
                                placeholder="Notatka do faktury (opcjonalnie)"
                                showError
                              />
                            )}
                          </form.AppField>
                        </>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      lineItemsField.pushValue({
                        description: '',
                        amount: '',
                        invoiceNote: '',
                      })
                    }
                  >
                    Dodaj pozycję
                  </Button>
                  <p className="text-foreground text-sm font-medium">Suma: {formatPLN(total)}</p>
                </div>
              )}
            </form.Field>
          )}
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
```

**Step 2: Verify the app compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors

**Step 3: Manual smoke test**

Run: `pnpm dev`

1. Open the transfer dialog
2. Verify shared fields appear at top (type selector, conditional register/investment/worker)
3. Verify line items section shows 1 row with description + amount + file + note
4. Click "Dodaj pozycję" — second row appears
5. Click remove on first row (should be disabled when only 1 item)
6. Switch type — shared conditional fields update correctly
7. Fill in 2 items and submit — verify transactions created in DB

**Step 4: Commit**

```bash
git add src/components/forms/transfer-form/transfer-form.tsx
git commit -m "feat: convert transfer form to always-bulk line items UI"
```

---

### Task 4: Verify end-to-end and clean up

**Files:**

- None new

**Step 1: Test single-item submission (regression)**

1. Open transfer dialog
2. Select INVESTMENT_EXPENSE, pick a register, pick an investment
3. Fill 1 line item (description + amount)
4. Submit — should create 1 transaction
5. Verify register balance recalculated
6. Verify investment costs recalculated

**Step 2: Test multi-item submission**

1. Open transfer dialog
2. Select INVESTMENT_EXPENSE, pick a register, pick an investment
3. Add 3 line items with different amounts
4. Attach invoice files to items 1 and 3
5. Submit — should create 3 transactions
6. Verify all 3 have correct shared fields (type, register, investment)
7. Verify invoice files attached to correct transactions
8. Verify register balance = previous - sum of all amounts
9. Verify investment costs updated

**Step 3: Test type switching**

1. Select INVESTMENT_EXPENSE, add 2 items
2. Switch to PAYOUT — line items should persist, conditional fields reset
3. Switch to ACCOUNT_FUNDING — file inputs and invoice notes should be hidden
4. Switch back to INVESTMENT_EXPENSE — investment field reappears

**Step 4: Test EMPLOYEE_EXPENSE expense target toggle**

1. Select EMPLOYEE_EXPENSE
2. Toggle between investment and other category
3. Verify investment/category fields show/hide correctly
4. Verify line items still work

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address bulk transfer edge cases"
```
