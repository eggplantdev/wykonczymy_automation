'use client'

import { useRef, useTransition } from 'react'
import { triggerDownload } from '@/lib/utils/trigger-download'
import {
  buildArchiveMessage,
  buildArchiveName,
  flattenArchiveRows,
  type ArchiveFileT,
  type ArchiveRowT,
} from '@/lib/media/file-archive'
import type { ArchiveCopyT } from '@/types/media'
import {
  startProgressToast,
  updateProgressToast,
  type ProgressToastIdT,
} from '@/lib/utils/progress-toast'
import { warsawToday } from '@/lib/utils/days'
import { useTranslation } from '@/hooks/use-translation'

// Browsers cap concurrent connections per origin; larger batches just queue and stall the progress toast.
const BATCH_SIZE = 6

export function useFileArchive() {
  const [isPending, startTransition] = useTransition()
  const toastIdRef = useRef<ProgressToastIdT | null>(null)
  const translator = useTranslation('media')
  const { t } = translator

  function pack(
    copy: ArchiveCopyT,
    nameParts: string[],
    files: ArchiveFileT[],
    rowTally: { rows: number; rowsWithFile: number },
  ) {
    startTransition(async () => {
      toastIdRef.current = startProgressToast(
        t(copy.kind === 'invoice' ? 'invoiceArchiveProgress' : 'fileArchiveProgress'),
      )

      try {
        const downloadedFiles =
          files.length === 0
            ? 0
            : await packAndDeliver(files, buildArchiveName(nameParts, warsawToday(), copy.prefix))
        const tally = { ...rowTally, expectedFiles: files.length, downloadedFiles }

        updateProgressToast(
          toastIdRef.current,
          buildArchiveMessage(tally, copy, translator),
          toneFor(tally),
        )
      } catch {
        updateProgressToast(toastIdRef.current, t('unexpectedError'), 'error')
      }
    })
  }

  function download(rows: ArchiveRowT[], nameParts: string[], copy: ArchiveCopyT) {
    pack(copy, nameParts, flattenArchiveRows(rows), {
      rows: rows.length,
      rowsWithFile: rows.filter((row) => row.invoices.length > 0).length,
    })
  }

  function downloadFiles(files: ArchiveFileT[], nameParts: string[], copy: ArchiveCopyT) {
    pack(copy, nameParts, files, { rows: 1, rowsWithFile: files.length > 0 ? 1 : 0 })
  }

  async function packAndDeliver(files: ArchiveFileT[], archiveName: string): Promise<number> {
    updateProgressToast(
      toastIdRef.current,
      t('fetchingFiles', { done: 0, total: files.length }),
      'info',
      false,
    )

    // Deferred so a client who never clicks doesn't pay for the ZIP machinery — this hook is
    // mounted on the public share page.
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    let downloaded = 0

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      await Promise.all(
        files.slice(i, i + BATCH_SIZE).map(async (file) => {
          try {
            const response = await fetch(file.url)
            if (!response.ok) return

            zip.file(file.name, await response.blob())
            downloaded++
            updateProgressToast(
              toastIdRef.current,
              t('fetchingFiles', { done: downloaded, total: files.length }),
              'info',
              false,
            )
          } catch {
            // skip files that fail to download
          }
        }),
      )
    }

    if (downloaded === 0) return 0

    updateProgressToast(toastIdRef.current, t('zipping'), 'info', false)
    triggerDownload(await zip.generateAsync({ type: 'blob' }), archiveName)
    return downloaded
  }

  return { download, downloadFiles, isPending }
}

function toneFor({
  rowsWithFile,
  downloadedFiles,
}: {
  rowsWithFile: number
  downloadedFiles: number
}): 'info' | 'success' | 'error' {
  if (rowsWithFile === 0) return 'info'
  return downloadedFiles === 0 ? 'error' : 'success'
}
