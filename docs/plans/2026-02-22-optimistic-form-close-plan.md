# Optimistic Form Close Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close form dialogs immediately on submit, reopen with saved values if server action fails.

**Architecture:** Zustand store owns dialog open/close state AND submission state. Form calls `store.submitOptimistically()` which closes the dialog and fires the server action async. On failure, the store reopens the dialog (sets `openFormId`), and the form initializes from the store snapshot. No `useEffect` — dialog open state is derived directly from the store.

**Tech Stack:** Zustand 5 (already installed), TanStack Form, Radix Dialog

---

### Task 1: Create Zustand optimistic form store

**Files:**

- Create: `src/stores/optimistic-form-store.ts`

**Step 1: Write the store**

```ts
import { create } from 'zustand'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

type PendingSubmissionT = {
  formId: string
  formValues: Record<string, unknown>
  invoiceFiles: Map<number, File>
  status: 'pending' | 'failed'
  error: string | null
}

type OptimisticFormStoreT = {
  // Dialog open/close — which formId is currently open (null = all closed)
  openFormId: string | null
  openDialog: (formId: string) => void
  closeDialog: () => void

  // Submission state
  submission: PendingSubmissionT | null
  submitOptimistically: (
    formId: string,
    formValues: Record<string, unknown>,
    invoiceFiles: Map<number, File>,
    action: () => Promise<ActionResultT>,
    successMessage: string,
  ) => void
  clearSubmission: () => void
}

export const useOptimisticFormStore = create<OptimisticFormStoreT>()((set) => ({
  openFormId: null,
  submission: null,

  openDialog: (formId) => set({ openFormId: formId }),
  closeDialog: () => set({ openFormId: null }),

  submitOptimistically: (formId, formValues, invoiceFiles, action, successMessage) => {
    // Close dialog + save form snapshot
    set({
      openFormId: null,
      submission: { formId, formValues, invoiceFiles, status: 'pending', error: null },
    })

    // Fire-and-forget — runs after dialog unmounts
    action().then((result) => {
      if (result.success) {
        set({ submission: null })
        toastMessage(successMessage, 'success')
      } else {
        // Reopen dialog with failed state
        set((state) => ({
          openFormId: formId,
          submission: state.submission
            ? { ...state.submission, status: 'failed', error: result.error }
            : null,
        }))
        toastMessage(result.error, 'error')
      }
    })
  },

  clearSubmission: () => set({ submission: null }),
}))
```

**Step 2: Commit**

```bash
git add src/stores/optimistic-form-store.ts
git commit -m "feat: add optimistic form submission store"
```

---

### Task 2: Update FormDialog — dialog open state from store, no useEffect

**Files:**

- Modify: `src/components/dialogs/form-dialog.tsx`

**Step 1: Replace local `isOpen` state with store**

Changes:

- Remove `useState` for `isOpen` — read `openFormId` from store instead
- Add `formId` prop
- `onOpenChange` calls `store.openDialog`/`store.closeDialog`
- On dismiss of recovered dialog, also call `store.clearSubmission()`
- `keepOpen` and `showConfirm` stay as local state (UI-only concerns)

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ConfirmCloseDialog } from '@/components/ui/confirm-close-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

type FormDialogPropsT = {
  formId: string
  trigger: React.ReactNode
  title: string
  description?: string
  showKeepOpen?: boolean
  children: (onSuccess: () => void) => React.ReactNode
}

export function FormDialog({
  formId,
  trigger,
  title,
  description,
  showKeepOpen = true,
  children,
}: FormDialogPropsT) {
  const [keepOpen, setKeepOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isOpen = useOptimisticFormStore((s) => s.openFormId === formId)
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  function handleOpenChange(open: boolean) {
    if (open) {
      openDialog(formId)
    } else {
      closeDialog()
      clearSubmission()
    }
  }

  function handleSuccess() {
    if (!keepOpen) closeDialog()
  }

  return (
    <>
      <span onClick={() => openDialog(formId)}>{trigger}</span>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="h-fit max-h-[80vh] sm:max-w-2xl"
          onInteractOutside={(e) => {
            e.preventDefault()
            setShowConfirm(true)
          }}
        >
          <div className="h-auto">
            <DialogHeader title={title} description={description} />
            <div className="mt-2 pr-1">{children(handleSuccess)}</div>
            {showKeepOpen && (
              <label className="flex cursor-pointer items-center gap-2 py-4 text-sm select-none">
                <Checkbox
                  checked={keepOpen}
                  onCheckedChange={(checked) => setKeepOpen(checked === true)}
                />
                Nie zamykaj po zapisaniu
              </label>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmCloseDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={() => handleOpenChange(false)}
      />
    </>
  )
}
```

**Step 2: Add `formId` to all 4 dialog callers**

`src/components/dialogs/add-transfer-dialog.tsx` — add `formId="transfer"`
`src/components/dialogs/add-deposit-dialog.tsx` — add `formId="deposit"`
`src/components/dialogs/add-settlement-dialog.tsx` — add `formId="settlement"`
`src/components/dialogs/add-register-transfer-dialog.tsx` — add `formId="register-transfer"`

Example for `add-transfer-dialog.tsx`:

```tsx
<FormDialog
  formId="transfer"
  trigger={...}
  title="Nowa transakcja"
>
```

Repeat for the other three.

**Step 3: Commit**

```bash
git add src/components/dialogs/
git commit -m "feat: FormDialog reads open state from Zustand store"
```

---

### Task 3: Update `useInvoiceFiles` to accept initial files for recovery

**Files:**

- Modify: `src/components/forms/hooks/use-invoice-files.ts`

**Step 1: Add `initialFiles` parameter**

```ts
import { useRef } from 'react'

export function useInvoiceFiles(initialFiles?: Map<number, File>) {
  const invoiceFilesRef = useRef<Map<number, File>>(initialFiles ?? new Map())

  // ... rest unchanged
}
```

Only change: add optional `initialFiles` param, use as initial value for `useRef`.

**Step 2: Commit**

```bash
git add src/components/forms/hooks/use-invoice-files.ts
git commit -m "feat: useInvoiceFiles accepts initial files for recovery"
```

---

### Task 4: Convert TransferForm to optimistic submission

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx`

**Step 1: Update onSubmit to use optimistic store**

Key changes:

1. Import `useOptimisticFormStore`
2. Read `submission` from store to get recovery values
3. In `onSubmit`: call `submitOptimistically()` then `onSuccess()` immediately
4. Pass `initialFiles` from store to `useInvoiceFiles` on recovery
5. Clear store when form mounts with recovery values (so re-submit works fresh)

```tsx
// Add imports
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

export function TransferForm({ referenceData, onSuccess }: TransferFormPropsT) {
  const FORM_ID = 'transfer'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clear)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined
  const recoveredFiles = recovering ? submission.invoiceFiles : undefined

  const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData } =
    useInvoiceFiles(recoveredFiles)

  // ... existing code ...

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        date: today(),
        type: 'INVESTMENT_EXPENSE',
        // ... rest of defaults
      } as FormValuesT),
    validators: {
      onSubmit: bulkTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      // Clear any previous failed submission
      if (recovering) clearSubmission()

      const data: CreateBulkTransferFormT = {
        // ... same transformation as before
      }

      const invoiceFormData = buildInvoiceFormData()

      // Optimistic close: save state, close dialog, fire action async
      submitOptimistically(
        FORM_ID,
        value as unknown as Record<string, unknown>,
        new Map(invoiceFilesRef.current), // snapshot file refs
        () => createBulkTransferAction(data, invoiceFormData),
        'Transakcje dodane',
      )
      onSuccess()

      return false
    },
  })

  // ... rest unchanged
}
```

**Problem:** `invoiceFilesRef` is internal to `useInvoiceFiles`. We need to expose the current files map.

Update `useInvoiceFiles` return to also expose `getFiles`:

```ts
// In use-invoice-files.ts, add to return:
function getFiles(): Map<number, File> {
  return new Map(invoiceFilesRef.current)
}

return { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles }
```

Then in TransferForm:

```tsx
const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles } =
  useInvoiceFiles(recoveredFiles)

// In onSubmit:
submitOptimistically(
  FORM_ID,
  value as unknown as Record<string, unknown>,
  getFiles(),
  () => createBulkTransferAction(data, invoiceFormData),
  'Transakcje dodane',
)
```

**Step 2: Commit**

```bash
git add src/components/forms/transfer-form/transfer-form.tsx src/components/forms/hooks/use-invoice-files.ts
git commit -m "feat: TransferForm uses optimistic close with recovery"
```

---

### Task 5: Convert DepositForm to optimistic submission

**Files:**

- Modify: `src/components/forms/deposit-form/deposit-form.tsx`

**Step 1: Same pattern as TransferForm**

DepositForm is simpler — no invoice files (passes `null`). Changes:

1. Import `useOptimisticFormStore`
2. Read recovery state
3. Use `submitOptimistically()` in `onSubmit`, call `onSuccess()` immediately

```tsx
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

export function DepositForm({ referenceData, onSuccess }: DepositFormPropsT) {
  const FORM_ID = 'deposit'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clear)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        description: '',
        amount: '',
        date: today(),
        type: 'INVESTOR_DEPOSIT',
        paymentMethod: 'CASH',
        sourceRegister: getDefaultCashRegister(referenceData),
        investment: '',
      } as FormValuesT),
    validators: { onSubmit: transferFormSchema },
    onSubmit: async ({ value }) => {
      if (recovering) clearSubmission()

      const data: CreateTransferFormT = {
        // ... same transformation
      }

      submitOptimistically(
        FORM_ID,
        value as unknown as Record<string, unknown>,
        new Map(),
        () => createTransferAction(data, null),
        'Wpłata dodana',
      )
      onSuccess()

      return false
    },
  })

  // ... rest unchanged
}
```

**Step 2: Commit**

```bash
git add src/components/forms/deposit-form/deposit-form.tsx
git commit -m "feat: DepositForm uses optimistic close with recovery"
```

---

### Task 6: Convert RegisterTransferForm to optimistic submission

**Files:**

- Modify: `src/components/forms/register-transfer-form/register-transfer-form.tsx`

**Step 1: Same pattern — no invoice files**

```tsx
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

export function RegisterTransferForm({ referenceData, onSuccess }: RegisterTransferFormPropsT) {
  const FORM_ID = 'register-transfer'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clear)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        description: '',
        amount: '',
        date: today(),
        paymentMethod: 'CASH',
        sourceRegister: getDefaultCashRegister(referenceData),
        targetRegister: '',
      } as FormValuesT),
    // ... same onSubmit pattern with submitOptimistically
  })
}
```

**Step 2: Commit**

```bash
git add src/components/forms/register-transfer-form/register-transfer-form.tsx
git commit -m "feat: RegisterTransferForm uses optimistic close with recovery"
```

---

### Task 7: Convert SettlementForm to optimistic submission

**Files:**

- Modify: `src/components/forms/settlement-form/settlement-form.tsx`

**Step 1: Same pattern with invoice files**

SettlementForm uses `useInvoiceFiles()` and also has local `saldo` state. Only the form values and files need recovery — saldo will re-fetch from the worker field's `onChange` listener.

```tsx
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

export function SettlementForm({ referenceData, className, onSuccess }: SettlementFormPropsT) {
  const FORM_ID = 'settlement'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clear)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined
  const recoveredFiles = recovering ? submission.invoiceFiles : undefined

  const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles } =
    useInvoiceFiles(recoveredFiles)

  // ... form with defaultValues: recoveredValues ?? { ... }
  // ... onSubmit with submitOptimistically pattern

  // Note: saldo won't auto-fetch on recovery since worker onChange doesn't fire for defaults.
  // If worker field has a value on mount, trigger saldo fetch:
  // useEffect(() => { if (recoveredValues?.worker) fetchSaldo(recoveredValues.worker) }, [])
}
```

**Note:** SettlementForm has `onSuccess?: () => void` (optional). When no `onSuccess`, it does `router.push('/')`. For optimistic close we need `onSuccess` to exist. The settlement dialog passes it, so this works. The standalone usage (without dialog) won't use optimistic close.

Wrap the optimistic path in a condition:

```tsx
if (onSuccess) {
  submitOptimistically(...)
  onSuccess()
} else {
  // Non-dialog usage: await result directly (existing behavior)
  const result = await createSettlementAction(data, buildInvoiceFormData())
  if (result.success) {
    toastMessage('Dodano', 'success')
    router.push('/')
  } else {
    toastMessage(result.error, 'error')
  }
}
```

**Step 2: Commit**

```bash
git add src/components/forms/settlement-form/settlement-form.tsx
git commit -m "feat: SettlementForm uses optimistic close with recovery"
```

---

### Task 8: Test manually and clean up

**Step 1: Verify build**

Run: `pnpm build`
Expected: No TypeScript errors

**Step 2: Manual test checklist**

- [ ] Open transfer dialog → fill form → submit → dialog closes immediately
- [ ] If server succeeds: success toast appears, no dialog reopen
- [ ] If server fails: error toast + dialog reopens with previous values
- [ ] Deposit dialog: same flow
- [ ] Register transfer dialog: same flow
- [ ] Settlement dialog: same flow
- [ ] Keep-open checkbox still works (dialog stays open, no optimistic close)
- [ ] Invoice files preserved on failure recovery

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: optimistic form close with auto-recovery on failure"
```
