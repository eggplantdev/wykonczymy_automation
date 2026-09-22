'use client'

import { useState } from 'react'
import {
  useInvoiceFiles,
  type IngestResultT,
} from '@/components/forms/expense-form/use-invoice-files'
import { filesByRowId } from '@/components/forms/expense-form/row-file-positions'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { toastMessage } from '@/lib/utils/toast'

type ArgsT = {
  // The previous submit's positional Map<number,File[]> (wire order), if this mount is a recovery.
  recoveredFiles?: Map<number, File[]>
  // The recovered rows, in the same order — the id-space the positional files re-key onto.
  storedLineItems?: { id: string }[]
}

/**
 * The receipt-ingest half of the wydatek form: file custody (via useInvoiceFiles) plus the busy
 * state and user-facing messaging that ingest needs to be usable. The form component owns the form;
 * this owns the pipeline a picked file travels through before it is allowed to become a line item's
 * invoice.
 *
 * `ingestingIds` is what the form does NOT get to ignore: a row still converting has no stored File
 * yet, so submitting mid-ingest would save the line item without its receipt. The form disables
 * submit on `isIngesting` and re-checks it in onSubmit, because a keyboard Enter bypasses the
 * button.
 */
export function useInvoiceIngest({ recoveredFiles, storedLineItems }: ArgsT) {
  // Rows whose picked file is still being processed at ingest (HEIC convert can take ~1-2 s). The
  // row shows a spinner and its actions are disabled meanwhile, and a batch scan waits for ingest
  // before running the AI generation. Keyed on each row's stable id (EX-448).
  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set())

  // recoveredFiles is positional (wire order). Re-key it to id-space against the recovered rows
  // (same order) so the restored form stays id-keyed — ids survive the submit→fail→restore
  // round-trip via the stored form values.
  const recoveredFilesById =
    recoveredFiles && storedLineItems ? filesByRowId(storedLineItems, recoveredFiles) : undefined

  const { handleFileChange, registerFilesAt, ...files } = useInvoiceFiles(recoveredFilesById)

  function markIngesting(ids: string[], busy: boolean) {
    setIngestingIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (busy ? next.add(id) : next.delete(id)))
      return next
    })
  }

  // The `finally` is load-bearing: an unexpected ingest rejection (e.g. a chunk-load failure on the
  // lazy import) must still release the rows, or they stay busy forever and wedge the whole form.
  // Blocked files enter no map; the row stays empty. The reactive file store re-renders attached
  // rows (input → thumbnail) on its own — no remount key.
  async function runIngest(ids: string[], ingest: () => Promise<IngestResultT>) {
    markIngesting(ids, true)
    try {
      reportBlockedFiles((await ingest()).blocked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      markIngesting(ids, false)
    }
  }

  return {
    ...files,
    ingestingIds,
    isIngesting: ingestingIds.size > 0,
    registerFiles: (ids: string[], picked: File[], mode?: 'per-row' | 'single-row') =>
      runIngest(ids, () => registerFilesAt(ids, picked, mode)),
    attachFile: (id: string, e: React.ChangeEvent<HTMLInputElement>) =>
      runIngest([id], () => handleFileChange(id, e)),
  }
}
