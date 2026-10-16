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
  recoveredFiles?: Map<number, File[]>
  storedLineItems?: { id: string }[]
}

export function useInvoiceIngest({ recoveredFiles, storedLineItems }: ArgsT) {
  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set())

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
  async function runIngest(ids: string[], ingest: () => Promise<IngestResultT>) {
    markIngesting(ids, true)
    try {
      reportBlockedFiles((await ingest()).blocked)
    } catch {
      // TODO(EX-958) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
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
