'use client'

import { useState } from 'react'
import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

type MediaUploadOptionsT = {
  attach: (mediaIds: number[]) => Promise<ActionResultT>
  successMessage: string
}

// No `router.refresh()` on success: both `attach` callbacks are server actions that revalidate.
export function useMediaUpload({ attach, successMessage }: MediaUploadOptionsT) {
  const { locale } = useI18nContext()
  const translator = useTranslation('media')
  const [isUploading, setIsUploading] = useState(false)

  async function ingestAndAttach(picked: File[], asPlan: boolean) {
    const { files: ready, blocked } = await ingestPickedFiles(picked, asPlan ? 'PLAN' : 'INVOICE')
    reportBlockedFiles(blocked, translator)

    if (ready.length === 0) return false

    const kind: MediaKindT | undefined = asPlan ? 'projekt' : undefined
    const result = await submitWithUploads(ready, attach, kind)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return false
    }

    toastMessage(successMessage, 'success')
    return true
  }

  async function uploadFiles(picked: File[], asPlan = false): Promise<boolean> {
    if (picked.length === 0) return false

    setIsUploading(true)
    try {
      return await ingestAndAttach(picked, asPlan)
    } catch {
      // TODO(EX-958) SENTRY-REQUIRED: unexpected ingest/upload failure — capture once Sentry is
      // wired; for now the user gets a generic retry toast.
      toastMessage(translator.t('uploadFailedRetry'), 'error', 6000)
      return false
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, uploadFiles }
}
