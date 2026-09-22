'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setMediaKindAction } from '@/lib/actions/media-kind'
import { toastMessage } from '@/lib/utils/toast'
import type { InvoiceFileT } from '@/types/transfers'
import type { MediaFileT } from '@/types/media'

/**
 * The „Oznacz jako rzut" affordance for an already-stored gallery.
 *
 * The marked ids are held locally on top of `files` because the server row does not refresh until
 * the revalidation lands — without it the button would keep offering „Oznacz" on a file that is
 * already oznaczony, which reads as a click that did nothing.
 */
export function usePlanMarker(files: MediaFileT[]) {
  const router = useRouter()
  const [markedIds, setMarkedIds] = useState<number[]>([])

  const isMarked = (file: InvoiceFileT) =>
    file.id !== undefined &&
    (markedIds.includes(file.id) ||
      files.find((candidate) => candidate.id === file.id)?.kind === 'projekt')

  async function mark(file: InvoiceFileT) {
    if (file.id === undefined) return

    const result = await setMediaKindAction(file.id, 'projekt')
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }

    setMarkedIds((current) => [...current, file.id as number])
    toastMessage('Plik oznaczony jako rzut', 'success')
    router.refresh()
  }

  return { isMarked, onMark: (file: InvoiceFileT) => void mark(file) }
}
