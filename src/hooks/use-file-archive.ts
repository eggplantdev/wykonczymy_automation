'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'react-toastify'
import { triggerDownload } from '@/lib/utils/trigger-download'
import {
  buildArchiveMessage,
  buildArchiveName,
  flattenArchiveRows,
  type ArchiveFileT,
  type ArchiveRowT,
} from '@/lib/media/file-archive'
import type { ArchiveCopyT } from '@/types/media'
import { toastMessage } from '@/lib/utils/toast'
import { today } from '@/lib/utils/date'

// Browsers cap concurrent connections per origin; larger batches just queue and stall the progress toast.
const BATCH_SIZE = 6

/**
 * Everything that happens *after* the rows are known: fetch each page, name it uniquely, zip,
 * hand the archive to the browser, and drive one in-place toast throughout.
 *
 * Split out of `InvoiceDownloadButton` because obtaining the rows and packing them are separate
 * concerns with separate auth needs — the transfers toolbar fetches its rows through an authenticated
 * server action, while the kosztorys Wydatki list already has them in props and runs on the
 * unauthenticated share path. Media is publicly readable, so packing needs no session either way.
 */
export function useFileArchive() {
  const [isPending, startTransition] = useTransition()
  const toastIdRef = useRef<string | number | null>(null)

  /**
   * Rows and files are counted separately because a row may carry several pages or none —
   * `rowsWithFile` is what lets the closing toast say „2 pozycje bez faktury" instead of silently
   * shipping a short archive.
   */
  function pack(
    copy: ArchiveCopyT,
    nameParts: string[],
    files: ArchiveFileT[],
    rowTally: { rows: number; rowsWithFile: number },
  ) {
    startTransition(async () => {
      toastIdRef.current = toast.info(copy.progress, {
        autoClose: false,
        position: 'bottom-center',
        theme: 'dark',
      })

      try {
        // Nothing to fetch is not a failed fetch — packing an empty set would announce the
        // „nie udało się" wording over a set that never had a file in it.
        const downloadedFiles =
          files.length === 0
            ? 0
            : await packAndDeliver(files, buildArchiveName(nameParts, today(), copy.prefix))
        const tally = { ...rowTally, expectedFiles: files.length, downloadedFiles }

        updateToast(toastIdRef.current, buildArchiveMessage(tally, copy), toneFor(tally))
      } catch {
        updateToast(toastIdRef.current, 'Wystąpił nieoczekiwany błąd', 'error')
      }
    })
  }

  /** Archives every page of every row, naming each file after its row's date and description. */
  function download(rows: ArchiveRowT[], nameParts: string[], copy: ArchiveCopyT) {
    pack(copy, nameParts, flattenArchiveRows(rows), {
      rows: rows.length,
      rowsWithFile: rows.filter((row) => row.invoices.length > 0).length,
    })
  }

  /**
   * Archives one surface's files, already named by the caller — the preview dialog keeps each
   * page's own filename, which the row-based naming would overwrite with a date.
   */
  function downloadFiles(files: ArchiveFileT[], nameParts: string[], copy: ArchiveCopyT) {
    pack(copy, nameParts, files, { rows: 1, rowsWithFile: files.length > 0 ? 1 : 0 })
  }

  async function packAndDeliver(files: ArchiveFileT[], archiveName: string): Promise<number> {
    updateToast(toastIdRef.current, `Pobieranie 0/${files.length} plików...`, 'info', false)

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
            updateToast(
              toastIdRef.current,
              `Pobieranie ${downloaded}/${files.length} plików...`,
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

    updateToast(toastIdRef.current, 'Tworzenie archiwum ZIP...', 'info', false)
    triggerDownload(await zip.generateAsync({ type: 'blob' }), archiveName)
    return downloaded
  }

  return { download, downloadFiles, isPending }
}

function updateToast(
  id: string | number | null,
  message: string,
  type: 'info' | 'success' | 'error',
  autoClose: number | false = 2000,
) {
  if (id === null) {
    toastMessage(message, type)
    return
  }
  toast.update(id, { render: message, type, autoClose, theme: 'dark' })
}

/** Nothing to pack is informational; a set that had files and delivered none is an error. */
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
