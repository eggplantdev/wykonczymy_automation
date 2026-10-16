'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { setMediaKindAction } from '@/lib/actions/media-kind'
import { toastMessage } from '@/lib/utils/toast'
import type { MediaFileT, PreviewFileT } from '@/types/media'

/**
 * The marked ids are held locally on top of `files` because the server row does not refresh until
 * the revalidation lands — without it the button would keep offering „Oznacz" on a file that is
 * already oznaczony, which reads as a click that did nothing.
 */
export function usePlanMarker(files: MediaFileT[]) {
  const [markedIds, setMarkedIds] = useState<number[]>([])
  const { t } = useTranslation('media')

  const isMarked = (file: PreviewFileT) =>
    file.id !== undefined &&
    (markedIds.includes(file.id) ||
      files.find((candidate) => candidate.id === file.id)?.kind === 'projekt')

  async function mark(file: PreviewFileT) {
    const id = file.id
    if (id === undefined) return

    try {
      const result = await setMediaKindAction(id, 'projekt')
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
    } catch {
      toastMessage(t('markFailed'), 'error')
      return
    }

    setMarkedIds((current) => [...current, id])
    toastMessage(t('markedForAiToast'), 'success')
  }

  return {
    isMarked,
    onMark: (file: PreviewFileT) => void mark(file),
    label: t('markForAi'),
    markedLabel: t('markedForAi'),
  }
}
