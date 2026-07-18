'use client'

import { useState } from 'react'
import { extractReceiptAction } from '@/lib/actions/extract-receipt'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { toastMessage } from '@/lib/utils/toast'
import { logError } from '@/lib/utils/log-error'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import type { OtherCategoryRefT } from '@/types/reference-data'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'

const GENERATION_CONCURRENCY = 4

type ReceiptGenerationDepsT = {
  form: BulkExpenseFormApiT
  otherCategories: OtherCategoryRefT[]
  getFiles: () => Map<string, File>
  renameFile: (id: string, newName: string) => void
}

export function useReceiptGeneration({
  form,
  otherCategories,
  getFiles,
  renameFile,
}: ReceiptGenerationDepsT) {
  const [isGenerating, setIsGenerating] = useState(false)
  // Marker sets key on the row's stable id, so a removal/reorder can't misalign them onto the
  // wrong row — no reindex shift needed (that's the whole point of EX-448).
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [generationProgress, setGenerationProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  async function generateFromReceipts() {
    const rows = form.getFieldValue('lineItems') ?? []
    const files = getFiles()
    // Eligible = has an attached file AND still-blank content, so a manually filled row is
    // never overwritten (skip-non-empty). Keep both the row's id (marker/file key) and its
    // current index (the field-path used to write results back).
    const eligible = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => files.has(row.id) && !row.description && !row.amount)

    if (eligible.length === 0) return

    setIsGenerating(true)
    setFailedIds(new Set())
    setGenerationProgress({ done: 0, total: eligible.length })
    const otherCategoryNames = otherCategories.map((c) => c.name)
    const failed = new Set<string>()
    const failedMessages = new Set<string>()
    let done = 0
    // A row the model couldn't read still fills (the sentinel lands in the Opis) and isn't a
    // hard failure, but it shouldn't count as read — it drops the tally (8/10) without a loud
    // per-row marker. The server-side SENTRY-REQUIRED log carries the detail.
    let unreadable = 0

    await mapWithConcurrency(eligible, GENERATION_CONCURRENCY, async ({ row, index }) => {
      const id = row.id
      setGeneratingIds((prev) => new Set(prev).add(id))
      try {
        // The map already holds the file processed at ingest (compressed / HEIC-converted), so the
        // scan payload is under the serverAction body limit without re-compressing here.
        const result = await extractReceiptAction({
          file: files.get(id)!,
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
        // Category is left blank for the user to pick — the model's category inference wasn't
        // reliable enough (frequent mismatches), so we no longer auto-assign it from the scan.
        // Apply the Opis-based name to the file now so it uploads under that name at submit, and
        // mirror it on the FV label (fileInputKey is bumped once generation finishes so the
        // uncontrolled input re-reads the name).
        if (data.filename) renameFile(id, data.filename)
      } catch (error) {
        // TODO(EX-449) SENTRY-REQUIRED: per-receipt AI extraction failures must be captured once
        // Sentry is wired — a failed row otherwise dies in a generic toast.
        logError(`[receipt-generation] row ${id} failed`, error)
        failed.add(id)
        failedMessages.add(error instanceof Error ? error.message : String(error))
      } finally {
        setGeneratingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        done += 1
        setGenerationProgress({ done, total: eligible.length })
      }
    })

    setFailedIds(failed)
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

  function resetGeneration() {
    setFailedIds(new Set())
    setGeneratingIds(new Set())
    setGenerationProgress(null)
  }

  return {
    generateFromReceipts,
    isGenerating,
    generatingIds,
    failedIds,
    generationProgress,
    resetGeneration,
  }
}
