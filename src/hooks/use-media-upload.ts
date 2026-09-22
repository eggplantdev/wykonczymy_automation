'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reportBlockedFiles } from '@/lib/invoices/blocked-files-message'
import { ingestPickedFiles } from '@/lib/invoices/ingest-picked-files'
import { submitWithInvoicePages } from '@/lib/invoices/submit-with-invoice-pages'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type MediaUploadOptionsT = {
  /** Attaches the uploaded ids to whatever owns them; runs only once the bytes are in Blob. */
  attach: (mediaIds: number[]) => Promise<ActionResultT>
  successMessage: string
}

/**
 * Pick → ingest → upload → attach, for the surfaces that attach files to an ALREADY SAVED row
 * (a transfer's faktura, an investment's zdjęcia). A form that creates the row in the same submit
 * uses `useFilePickIngest` + `submitWithInvoicePages` instead — there the row does not exist yet.
 *
 * `isUploading` is what the caller needs back: the picker gives no feedback of its own, so without
 * it a slow HEIC convert reads as a click that did nothing.
 */
export function useMediaUpload({ attach, successMessage }: MediaUploadOptionsT) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)

  async function ingestAndAttach(picked: File[]) {
    const { files: ready, blocked } = await ingestPickedFiles(picked)
    reportBlockedFiles(blocked)

    if (ready.length === 0) return

    const result = await submitWithInvoicePages(ready, attach)
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }

    // Without the toast the click ends with the surface looking untouched until the refresh lands,
    // which reads as a failed upload and invites a second pick of the same photo.
    toastMessage(successMessage, 'success')
    router.refresh()
  }

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the trigger, or the picker stays disabled until a reload.
  async function uploadFiles(picked: File[]) {
    if (picked.length === 0) return

    setIsUploading(true)
    try {
      await ingestAndAttach(picked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest/upload failure — capture once Sentry is
      // wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przesłać pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, uploadFiles }
}
