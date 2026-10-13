import { useState } from 'react'
import type {
  BulkExpenseFormApiT,
  BulkLineItemT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { bulkExpenseFormSchema } from '@/components/forms/expense-form/bulk-expense-schema'
import type { ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { positionalFiles } from '@/components/forms/expense-form/row-file-positions'
import { subsetFieldErrors } from '@/components/forms/expense-form/subset-field-errors'
import { toBulkData } from '@/components/forms/expense-form/to-bulk-data'
import { useDraftReceipts } from '@/components/forms/expense-form/use-draft-receipts'
import type { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import type { SubmitConfirmCopyT } from '@/components/forms/hooks/use-submit-confirm'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import {
  rejectExpenseParagonsAction,
  restoreSkippedReceiptAction,
} from '@/lib/actions/worker-expense-drafts'
import { isInvestmentExpense } from '@/lib/constants/transfers'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'
import { fetchExpenseDraftDecisions } from '@/lib/queries/expense-draft-decisions'
import { missingInvoiceConfirm } from '@/lib/transfers/missing-invoice-confirm'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { receiptDecision } from '@/lib/worker-expenses/receipt-decision'
import { isReceiptOf } from '@/lib/worker-expenses/receipt-refusal'
import type { FailureT } from '@/types/action'

type OptionsT = {
  prefill: ExpenseFormPrefillT | undefined
  isParagonMode: boolean
  form: BulkExpenseFormApiT
  lineItems: BulkLineItemT[]
  replaceRows: (removeIds: string[], add: [id: string, files: File[]][]) => void
  isBusy: boolean
  getFiles: () => Map<string, File[]>
  ask: (copy: SubmitConfirmCopyT) => Promise<boolean>
  submit: ReturnType<typeof useFormSubmit>['submit']
  linkedMediaIdOf: (file: File) => number | undefined
  onSubmitSuccess: () => void
  onDecided?: () => void
}

// A lost response may have booked the paragon, and a refusal means someone else decided it: in both
// cases only the server knows what is still waiting.
const needsResync = (failure: FailureT) =>
  failure.code === 'REQUEST_FAILED' || failure.code === 'ALREADY_DECIDED'

export function useParagonDecisions({
  prefill,
  isParagonMode,
  form,
  lineItems,
  replaceRows,
  isBusy,
  getFiles,
  ask,
  submit,
  linkedMediaIdOf,
  onSubmitSuccess,
  onDecided,
}: OptionsT) {
  const [rejected, setRejected] = useState(() => prefill?.rejectedReceipts ?? [])
  const [isDeciding, setIsDeciding] = useState(false)

  const draftReceipts = useDraftReceipts({
    source: prefill,
    lineItems,
    setLineItems: (items) => form.setFieldValue('lineItems', items),
    replaceRows,
    isBusy: isBusy || isDeciding,
  })

  function close(failure?: FailureT) {
    if (failure?.messageKey !== 'draftAlreadyDecided') {
      toastMessage(pl.notices.draftAlreadyDecided, 'warning')
    }
    onDecided?.()
    onSubmitSuccess()
  }

  async function resync(failure: FailureT) {
    if (!prefill) return
    const result = await settleAction(() => fetchExpenseDraftDecisions(prefill.expenseDraftId))
    if (!result.success) {
      if (result.messageKey === 'draftAlreadyDecided') close(failure)
      return
    }
    if (result.data.status !== 'pending') {
      close(failure)
      return
    }
    setRejected(result.data.rejectedReceipts)
    draftReceipts.resync(result.data)
    onDecided?.()
  }

  // A decided paragon stays in the list, so the dialog closes on the last one still waiting.
  function afterDecision(decidedIds: string[]) {
    onDecided?.()
    if ([...draftReceipts.pendingIds].every((id) => decidedIds.includes(id))) onSubmitSuccess()
  }

  function setSubmitErrors(errors: [name: string, message: string | undefined][]) {
    for (const [name, message] of errors) {
      form.setFieldMeta(name as never, (meta) => ({
        ...meta,
        // Shaped like a schema issue, which is what the field's error line reads.
        errorMap: { ...meta?.errorMap, onSubmit: message && { message } },
      }))
    }
  }

  // Validated on its own: the rows still waiting may be half-filled, and they aren't being booked.
  function validateSubset(subset: BulkLineItemT[]) {
    const value = form.state.values
    const indexOf = new Map(value.lineItems.map((item, index) => [item.id, index]))
    const stale = subset
      .flatMap((item) =>
        Object.keys(item).map((field) => `lineItems[${indexOf.get(item.id)}].${field}`),
      )
      .filter((name) => form.getFieldMeta(name as never)?.errorMap?.onSubmit)
    setSubmitErrors(stale.map((name) => [name, undefined]))
    const check = bulkExpenseFormSchema.safeParse({ ...value, lineItems: subset })
    if (check.success) return true
    const errors = subsetFieldErrors(
      check.error.issues,
      (subsetIndex) => indexOf.get(subset[subsetIndex].id) ?? -1,
    )
    if (errors.length > 0) setSubmitErrors(errors)
    else toastMessage(check.error.issues[0]?.message ?? 'Uzupełnij pozycję', 'warning')
    return false
  }

  async function bookRows(ids: string[]) {
    if (!prefill) return
    const value = form.state.values
    const subset = value.lineItems.filter((item) => ids.includes(item.id))
    if (!validateSubset(subset)) return
    const files = positionalFiles(subset, getFiles())
    const missingInvoice = isInvestmentExpense(value.type) && missingInvoiceConfirm(subset, files)
    if (missingInvoice && !(await ask(missingInvoice))) return

    const data = toBulkData(value, subset)
    setIsDeciding(true)
    try {
      await submit(true, {
        action: () =>
          submitWithUploadRows(
            subset.length,
            files,
            (invoicePageRows) =>
              createBulkTransferAction(data, invoicePageRows, {
                expenseDraftId: prefill.expenseDraftId,
                ...receiptDecision(draftReceipts.receipts, subset),
                skippedReceipts: [],
              }),
            linkedMediaIdOf,
          ),
        successMessage: subset.length === 1 ? 'Paragon przyjęty' : `Przyjęto ${subset.length}`,
        files,
        onSubmitSuccess,
        onSaved: () => {
          draftReceipts.decide(ids, 'accepted')
          afterDecision(ids)
        },
        onFailed: (failure) => (needsResync(failure) ? resync(failure) : undefined),
      })
    } finally {
      setIsDeciding(false)
    }
  }

  async function rejectRows(ids: string[], duplicateOf?: DuplicateOfT) {
    if (!prefill) return
    const parts = ids.flatMap((id) => draftReceipts.receipts.get(id) ?? [])
    setIsDeciding(true)
    try {
      const result = await settleAction(() =>
        rejectExpenseParagonsAction(
          prefill.expenseDraftId,
          parts.map((part) => ({ mediaIds: part.mediaIds, readRow: part.readRow, duplicateOf })),
        ),
      )
      if (!result.success) {
        toastMessage(result.error, 'error')
        if (needsResync(result)) await resync(result)
        return
      }
      toastMessage(ids.length === 1 ? 'Paragon odrzucony' : `Odrzucono ${ids.length}`)
      setRejected((prev) => [...prev, ...result.data])
      draftReceipts.decide(ids, 'rejected')
      afterDecision(ids)
    } finally {
      setIsDeciding(false)
    }
  }

  function refusalsOf(id: string) {
    const parts = draftReceipts.receipts.get(id) ?? []
    return rejected.filter((receipt) => parts.some((part) => isReceiptOf(receipt, part)))
  }

  // One restore per refused paragon: a failure midway leaves some restored, which only a resync sees.
  async function undoReject(id: string) {
    setIsDeciding(true)
    try {
      for (const receipt of refusalsOf(id)) {
        const result = await settleAction(() => restoreSkippedReceiptAction(receipt.id))
        if (!result.success) {
          toastMessage(result.error, 'error')
          await resync(result)
          return
        }
        setRejected((prev) => prev.filter((r) => r.id !== receipt.id))
      }
      draftReceipts.undecide(id)
      onDecided?.()
    } finally {
      setIsDeciding(false)
    }
  }

  const receiptGrouping = draftReceipts.grouping && {
    ...draftReceipts.grouping,
    ...(isParagonMode && {
      onDecide: (ids: string[], decision: 'accept' | 'reject') =>
        decision === 'accept' ? bookRows(ids) : rejectRows(ids),
      // A photo refused without a read has no row the restore can name.
      undoFor: (id: string) => {
        const receipts = refusalsOf(id)
        return receipts.length > 0 && receipts.every((receipt) => receipt.readRow !== null)
          ? () => void undoReject(id)
          : undefined
      },
    }),
  }

  return { draftReceipts, receiptGrouping, isDeciding, rejectRows }
}
