'use client'

import { useState } from 'react'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

type MediaUploadOptionsT = {
  /** Attaches the uploaded ids to whatever owns them; runs only once the bytes are in Blob. */
  attach: (mediaIds: number[]) => Promise<ActionResultT>
  successMessage: string
}

/**
 * Pick → ingest → upload → attach, for the surfaces that attach files to an ALREADY SAVED row
 * (a transfer's faktura, an investment's zdjęcia). A form that creates the row in the same submit
 * uses `useFilePickIngest` + `submitWithUploads` instead — there the row does not exist yet.
 *
 * `isUploading` is what the caller needs back: the picker gives no feedback of its own, so without
 * it a slow HEIC convert reads as a click that did nothing.
 *
 * No `router.refresh()` on success, for the EX-597 reason: both `attach` callbacks are server
 * actions that revalidate, and `updateTag` already streams a fresh render of the calling route back
 * in the action response — refreshing on top of it rendered the route twice per upload (EX-850).
 * Only the bytes travel through an API route; the attach never does. A future caller that attaches
 * WITHOUT a revalidating action owes its own refresh rather than a reinstatement here.
 */
export function useMediaUpload({ attach, successMessage }: MediaUploadOptionsT) {
  const [isUploading, setIsUploading] = useState(false)

  // The two effects of the marker travel together on purpose: a rysunek needs the bigger profile to
  // stay readable AND the `kind` for a later reader to find it. Splitting them would let a file be
  // labelled a projekt while compressed as a faktura.
  async function ingestAndAttach(picked: File[], asPlan: boolean) {
    const { files: ready, blocked } = await ingestPickedFiles(picked, asPlan ? 'PLAN' : 'INVOICE')
    reportBlockedFiles(blocked)

    if (ready.length === 0) return

    const kind: MediaKindT | undefined = asPlan ? 'projekt' : undefined
    const result = await submitWithUploads(ready, attach, kind)
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }

    // Without the toast the click ends with the surface looking untouched until the re-render lands,
    // which reads as a failed upload and invites a second pick of the same photo.
    toastMessage(successMessage, 'success')
  }

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the trigger, or the picker stays disabled until a reload.
  async function uploadFiles(picked: File[], asPlan = false) {
    if (picked.length === 0) return

    setIsUploading(true)
    try {
      await ingestAndAttach(picked, asPlan)
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
