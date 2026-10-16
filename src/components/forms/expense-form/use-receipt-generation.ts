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
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [generationProgress, setGenerationProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  function generateFromReceipts() {
    const files = getFiles()
    return runGeneration(
      files,
      currentRows().filter((row) => files.has(row.id) && isBlankRow(row)),
    )
  }

  function regenerateRow(id: string) {
    const files = getFiles()
    return runGeneration(
      files,
      currentRows().filter((row) => row.id === id && files.has(id)),
    )
  }

  function currentRows() {
    return form.getFieldValue('lineItems') ?? []
  }

  async function runGeneration(
    files: Map<string, File[]>,
    eligible: ReturnType<typeof currentRows>,
  ) {
    if (eligible.length === 0) return

    setIsGenerating(true)
    usePendingStore.getState().start(SCAN_PENDING_KEY, 'Odczytywanie paragonów…')
    const eligibleIds = new Set(eligible.map((row) => row.id))
    setFailedIds((prev) => new Set([...prev].filter((id) => !eligibleIds.has(id))))
    setGenerationProgress({ done: 0, total: eligible.length })
    const otherCategoryNames = otherCategories.map((c) => c.name)
    const failed = new Set<string>()
    const failedMessages = new Set<string>()
    let done = 0
    let unreadable = 0

    // Every teardown belongs in the one `finally`, not after the await: `mapWithConcurrency`
    // propagates a rejecting `fn`, and anything left outside would be skipped on that path —
    // stranding `isGenerating` true, which disables the scan button and every row's remove
    // control until unmount.
    try {
      await mapWithConcurrency(eligible, GENERATION_CONCURRENCY, async ({ id }) => {
        setGeneratingIds((prev) => new Set(prev).add(id))
        try {
          const data = await scanReceiptClient(files.get(id)!, otherCategoryNames)
          if (data.description === UNREADABLE_RECEIPT) unreadable += 1
          // Resolved after the await: a row removed meanwhile („Duplikat") shifts the ones below it.
          const index = currentRows().findIndex((row) => row.id === id)
          if (index !== -1) applyReceiptToRow(form.setFieldValue, index, data)
          if (data.filename) renameFile(id, data.filename)
        } catch (error) {
          // TODO(EX-958) SENTRY-REQUIRED: per-receipt AI extraction failures must be captured once
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
    } catch (error) {
      // TODO(EX-958) SENTRY-REQUIRED.
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
      // TODO(EX-958) SENTRY-REQUIRED: dev/test only — surface the actual provider/upload error text
      // so failures are diagnosable without devtools.
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
