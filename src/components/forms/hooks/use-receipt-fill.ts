'use client'

import { useState } from 'react'
import { extractReceiptAction } from '@/lib/actions/extract-receipt'
import { resolveExpenseCategoryId } from '@/components/forms/form-fields/resolve-expense-category-id'
import { uploadFileClient } from '@/lib/utils/upload-file-client'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { toastMessage } from '@/lib/utils/toast'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

const FILL_CONCURRENCY = 4

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormT = any

type LineItemRowT = { description: string; amount: string }

type ReceiptFillDepsT = {
  form: FormT
  categories: ExpenseCategoryRefT[]
  getFiles: () => Map<number, File>
  getMediaId: (index: number) => number | undefined
  setMediaId: (index: number, mediaId: number) => void
}

// Mirrors reindexAfterRemoval for the file maps, kept aligned with the line-items array.
function reindexSet(set: Set<number>, removedIndex: number): Set<number> {
  const next = new Set<number>()
  set.forEach((i) => {
    if (i < removedIndex) next.add(i)
    else if (i > removedIndex) next.add(i - 1)
  })
  return next
}

export function useReceiptFill({
  form,
  categories,
  getFiles,
  getMediaId,
  setMediaId,
}: ReceiptFillDepsT) {
  const [isFilling, setIsFilling] = useState(false)
  const [fillingIndices, setFillingIndices] = useState<Set<number>>(new Set())
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function fillFromReceipts() {
    const rows = (form.getFieldValue('lineItems') ?? []) as LineItemRowT[]
    const files = getFiles()
    // Eligible = attached image AND still-blank content, so a manually filled row is never
    // overwritten (skip-non-empty).
    const eligible = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => files.has(index) && !row.description && !row.amount)

    if (eligible.length === 0) return

    setIsFilling(true)
    setFailedIndices(new Set())
    setProgress({ done: 0, total: eligible.length })
    const categoryNames = categories.map((c) => c.name)
    const failed = new Set<number>()
    let done = 0

    await mapWithConcurrency(eligible, FILL_CONCURRENCY, async ({ index }) => {
      setFillingIndices((prev) => new Set(prev).add(index))
      try {
        let mediaId = getMediaId(index)
        if (mediaId === undefined) {
          mediaId = await uploadFileClient(files.get(index)!)
          setMediaId(index, mediaId)
        }
        const result = await extractReceiptAction({ mediaId, expenseCategoryNames: categoryNames })
        if (!result.success) throw new Error(result.error)

        const data = result.data
        form.setFieldValue(`lineItems[${index}].description`, data.description)
        form.setFieldValue(
          `lineItems[${index}].amount`,
          data.amount === null ? '' : String(data.amount),
        )
        form.setFieldValue(`lineItems[${index}].invoiceNote`, data.invoiceNote)
        form.setFieldValue(
          `lineItems[${index}].expenseCategory`,
          resolveExpenseCategoryId(data.expenseCategoryName, categories),
        )
      } catch {
        failed.add(index)
      } finally {
        setFillingIndices((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        done += 1
        setProgress({ done, total: eligible.length })
      }
    })

    setFailedIndices(failed)
    setIsFilling(false)
    setProgress(null)

    const ok = eligible.length - failed.size
    if (failed.size === 0) toastMessage(`Odczytano ${ok} z ${eligible.length} paragonów`, 'success')
    else toastMessage(`Nie odczytano ${failed.size} z ${eligible.length} paragonów`, 'warning')
  }

  // Re-align the failed/in-flight markers when a row is removed so they don't point at the
  // wrong row after the array shifts.
  function onRowRemoved(index: number) {
    setFailedIndices((prev) => reindexSet(prev, index))
    setFillingIndices((prev) => reindexSet(prev, index))
  }

  function resetFill() {
    setFailedIndices(new Set())
    setFillingIndices(new Set())
    setProgress(null)
  }

  return {
    fillFromReceipts,
    isFilling,
    fillingIndices,
    failedIndices,
    progress,
    onRowRemoved,
    resetFill,
  }
}
