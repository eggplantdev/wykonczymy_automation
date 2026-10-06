'use client'

import { useState } from 'react'
import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { toastMessage } from '@/lib/utils/toast'
import { logError } from '@/lib/utils/log-error'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import { applyReceiptToRow } from '@/components/forms/expense-form/apply-receipt-to-row'
import type { OtherCategoryRefT } from '@/types/reference-data'
import {
  isBlankRow,
  type BulkExpenseFormApiT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { usePendingStore } from '@/stores/pending-store'

const GENERATION_CONCURRENCY = 4
const SCAN_PENDING_KEY = 'receipt-generation'

type ReceiptGenerationDepsT = {
  form: BulkExpenseFormApiT
  otherCategories: OtherCategoryRefT[]
  getFiles: () => Map<string, File[]>
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

  // Eligible = has an attached file AND still-blank content, so a manually filled row is never
  // overwritten (skip-non-empty). Keep both the row's id (marker/file key) and its current index
  // (the field-path used to write results back).
  function generateFromReceipts() {
    const files = getFiles()
    return runGeneration(
      files,
      indexedRows().filter(({ row }) => files.has(row.id) && isBlankRow(row)),
    )
  }

  // The one deliberate overwrite: the manager asked for this row again, filled or not.
  function regenerateRow(id: string) {
    const files = getFiles()
    return runGeneration(
      files,
      indexedRows().filter(({ row }) => row.id === id && files.has(id)),
    )
  }

  function indexedRows() {
    return (form.getFieldValue('lineItems') ?? []).map((row, index) => ({ row, index }))
  }

  async function runGeneration(
    files: Map<string, File[]>,
    eligible: ReturnType<typeof indexedRows>,
  ) {
    if (eligible.length === 0) return

    setIsGenerating(true)
    usePendingStore.getState().start(SCAN_PENDING_KEY, 'Odczytywanie paragonów…')
    // Only the rows being read lose their marker: a single-row re-read leaves the others' verdicts.
    const eligibleIds = new Set(eligible.map(({ row }) => row.id))
    setFailedIds((prev) => new Set([...prev].filter((id) => !eligibleIds.has(id))))
    setGenerationProgress({ done: 0, total: eligible.length })
    const otherCategoryNames = otherCategories.map((c) => c.name)
    const failed = new Set<string>()
    const failedMessages = new Set<string>()
    let done = 0
    // A row the model couldn't read still fills (the sentinel lands in the Opis) and isn't a
    // hard failure, but it shouldn't count as read — it drops the tally (8/10) without a loud
    // per-row marker. The server-side SENTRY-REQUIRED log carries the detail.
    let unreadable = 0

    // Every teardown belongs in the one `finally`, not after the await: `mapWithConcurrency`
    // propagates a rejecting `fn`, and anything left outside would be skipped on that path —
    // stranding `isGenerating` true, which disables the scan button and every row's remove
    // control until unmount. The pill matters most (it is portalled to document.body, so it
    // would sit over every page, not just this form), but it is not the only thing to clear.
    try {
      await mapWithConcurrency(eligible, GENERATION_CONCURRENCY, async ({ row, index }) => {
        const id = row.id
        setGeneratingIds((prev) => new Set(prev).add(id))
        try {
          // The map already holds the files processed at ingest (compressed / HEIC-converted), and
          // every page of this row goes into ONE scan — the total may sit on any of them.
          const data = await scanReceiptClient(files.get(id)!, otherCategoryNames)
          if (data.description === UNREADABLE_RECEIPT) unreadable += 1
          applyReceiptToRow(form.setFieldValue, index, data)
          // Apply the Opis-based name to the file now so it uploads under that name at submit; the
          // reactive file store re-renders the FV label to match.
          if (data.filename) renameFile(id, data.filename)
        } catch (error) {
          // TODO(EX-449) SENTRY-REQUIRED: per-receipt AI extraction failures must be captured once
          // Sentry is wired — a failed row otherwise dies in a generic toast.
          logError(`[receipt-generation] row ${id} failed`, error)
          // The file stays attached: the scan is an auxiliary read, not a validity gate. Most
          // failures are provider, network or unreadable-photo ones, and file validity is already
          // enforced by the picker's `accept`, by ingest and by `media.mimeTypes`.
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
    } catch (error) {
      // The caller's prop is `() => void` (line-items-field's onGenerate), so it is invoked
      // fire-and-forget and has nowhere to put a rejection. Reporting it here is what keeps an
      // escaped error a visible failure rather than an unhandled rejection in the console.
      // TODO(EX-449) SENTRY-REQUIRED.
      logError('[receipt-generation] scan aborted', error)
      toastMessage('Skanowanie paragonów zostało przerwane', 'error')
      return
    } finally {
      usePendingStore.getState().stop(SCAN_PENDING_KEY)
      setFailedIds((prev) => new Set([...prev, ...failed]))
      setIsGenerating(false)
      setGenerationProgress(null)
    }

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
    regenerateRow,
    isGenerating,
    generatingIds,
    failedIds,
    generationProgress,
    resetGeneration,
  }
}
