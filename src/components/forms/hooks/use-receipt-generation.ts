'use client'

import { useState } from 'react'
import { extractReceiptAction } from '@/lib/actions/extract-receipt'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import { reindexAfterRemoval } from '@/components/forms/hooks/use-invoice-files'
import { compressImage } from '@/lib/utils/compress-image'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { toastMessage } from '@/lib/utils/toast'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import type { OtherCategoryRefT } from '@/types/reference-data'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'

const GENERATION_CONCURRENCY = 4

type ReceiptGenerationDepsT = {
  form: BulkExpenseFormApiT
  otherCategories: OtherCategoryRefT[]
  getFiles: () => Map<number, File>
  renameFile: (index: number, newName: string) => void
}

// failedIndices / generatingIndices store row POSITIONS. Deleting a row shifts every later
// position down by one, so a stored marker must shift with it — otherwise it highlights the
// wrong row. A set of positions is the same shape as the keys of a position→value map, so
// wrap it as a map, reuse the file map's reindexAfterRemoval shift, then take the keys back
// (rather than re-deriving the same off-by-one arithmetic here). The map values are filler.
function reindexSet(set: Set<number>, removedIndex: number): Set<number> {
  const asMap = new Map([...set].map((i) => [i, true as const]))
  return new Set(reindexAfterRemoval(asMap, removedIndex).keys())
}

export function useReceiptGeneration({
  form,
  otherCategories,
  getFiles,
  renameFile,
}: ReceiptGenerationDepsT) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingIndices, setGeneratingIndices] = useState<Set<number>>(new Set())
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set())
  const [generationProgress, setGenerationProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  async function generateFromReceipts() {
    const rows = form.getFieldValue('lineItems') ?? []
    const files = getFiles()
    // Eligible = has an attached file AND still-blank content, so a manually filled row is
    // never overwritten (skip-non-empty).
    const eligible = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => files.has(index) && !row.description && !row.amount)

    if (eligible.length === 0) return

    setIsGenerating(true)
    setFailedIndices(new Set())
    setGenerationProgress({ done: 0, total: eligible.length })
    const otherCategoryNames = otherCategories.map((c) => c.name)
    const failed = new Set<number>()
    const failedMessages = new Set<string>()
    let done = 0
    // A row the model couldn't read still fills (the sentinel lands in the Opis) and isn't a
    // hard failure, but it shouldn't count as read — it drops the tally (8/10) without a loud
    // per-row marker. The server-side SENTRY-REQUIRED log carries the detail.
    let unreadable = 0

    await mapWithConcurrency(eligible, GENERATION_CONCURRENCY, async ({ index }) => {
      setGeneratingIndices((prev) => new Set(prev).add(index))
      try {
        // Compress client-side (as the submit upload does) so the scan payload stays under the
        // serverAction body limit; the model reads the smaller image fine.
        const compressed = await compressImage(files.get(index)!)
        const result = await extractReceiptAction({
          file: compressed,
          otherCategoryNames,
        })
        if (!result.success) throw new Error(result.error)

        const data = result.data
        if (data.description === UNREADABLE_RECEIPT) unreadable += 1
        form.setFieldValue(`lineItems[${index}].description`, data.description)
        form.setFieldValue(
          `lineItems[${index}].amount`,
          data.amount === null ? '' : String(data.amount),
        )
        form.setFieldValue(`lineItems[${index}].invoiceNote`, data.invoiceNote)
        form.setFieldValue(
          `lineItems[${index}].category`,
          resolveExpenseCategoryId(data.otherCategoryName, otherCategories),
        )
        // Apply the Opis-based name to the file now so it uploads under that name at submit, and
        // mirror it on the FV label (fileInputKey is bumped once generation finishes so the
        // uncontrolled input re-reads the name).
        if (data.filename) renameFile(index, data.filename)
      } catch (error) {
        // TODO(EX-449) SENTRY-REQUIRED: per-receipt AI extraction failures must be captured once
        // Sentry is wired — a failed row otherwise dies in a generic toast.
        console.error(`[receipt-generation] row ${index} failed`, error)
        failed.add(index)
        failedMessages.add(error instanceof Error ? error.message : String(error))
      } finally {
        setGeneratingIndices((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        done += 1
        setGenerationProgress({ done, total: eligible.length })
      }
    })

    setFailedIndices(failed)
    setIsGenerating(false)
    setGenerationProgress(null)

    const ok = eligible.length - failed.size - unreadable
    if (failed.size === 0) {
      toastMessage(`Odczytano ${ok} z ${eligible.length} paragonów`, 'success')
    } else {
      toastMessage(`Nie odczytano ${failed.size} z ${eligible.length} paragonów`, 'warning')
      // TODO(EX-449) SENTRY-REQUIRED: dev/test only — surface the actual provider/upload error text
      // so failures are diagnosable without devtools. Kept until Sentry carries this in prod;
      // NODE_ENV-gated so it never leaks to users. Longer autoClose since these are long.
      if (process.env.NODE_ENV !== 'production') {
        failedMessages.forEach((message) => toastMessage(message, 'error', 10000))
      }
    }
  }

  // Re-align the failed/in-flight markers when a row is removed so they don't point at the
  // wrong row after the array shifts.
  function onRowRemoved(index: number) {
    setFailedIndices((prev) => reindexSet(prev, index))
    setGeneratingIndices((prev) => reindexSet(prev, index))
  }

  function resetGeneration() {
    setFailedIndices(new Set())
    setGeneratingIndices(new Set())
    setGenerationProgress(null)
  }

  return {
    generateFromReceipts,
    isGenerating,
    generatingIndices,
    failedIndices,
    generationProgress,
    onRowRemoved,
    resetGeneration,
  }
}
