'use client'

import { useState } from 'react'
import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import type { MediaUploaderT } from '@/lib/media/upload-ids'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

type MediaUploadOptionsT = {
  /** Attaches the uploaded ids to whatever owns them; runs only once the bytes are in Blob. */
  attach: (mediaIds: number[]) => Promise<ActionResultT>
  successMessage: string
  /** Defaults to the browser-to-Blob path; a surface opts into the fast path by passing its router. */
  upload?: MediaUploaderT
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
export function useMediaUpload({ attach, successMessage, upload }: MediaUploadOptionsT) {
  const { locale } = useI18nContext()
  const translator = useTranslation('media')
  const [isUploading, setIsUploading] = useState(false)

  // The two effects of the marker travel together on purpose: a rysunek needs the bigger profile to
  // stay readable AND the `kind` for a later reader to find it. Splitting them would let a file be
  // labelled a projekt while compressed as a faktura.
  async function ingestAndAttach(picked: File[], asPlan: boolean) {
    const { files: ready, blocked } = await ingestPickedFiles(picked, asPlan ? 'PLAN' : 'INVOICE')
    reportBlockedFiles(blocked, translator)

    if (ready.length === 0) return false

    const kind: MediaKindT | undefined = asPlan ? 'projekt' : undefined
    const result = await submitWithUploads(ready, attach, kind, upload)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return false
    }

    // Without the toast the click ends with the surface looking untouched until the re-render lands,
    // which reads as a failed upload and invites a second pick of the same photo.
    toastMessage(successMessage, 'success')
    return true
  }

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the trigger, or the picker stays disabled until a reload.
  async function uploadFiles(picked: File[], asPlan = false): Promise<boolean> {
    if (picked.length === 0) return false

    setIsUploading(true)
    try {
      return await ingestAndAttach(picked, asPlan)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest/upload failure — capture once Sentry is
      // wired; for now the user gets a generic retry toast.
      toastMessage(translator.t('uploadFailedRetry'), 'error', 6000)
      return false
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, uploadFiles }
}
