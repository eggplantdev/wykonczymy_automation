'use client'

import { useState } from 'react'
import { setMediaKindAction } from '@/lib/actions/media-kind'
import { toastMessage } from '@/lib/utils/toast'
import type { MediaFileT, PreviewFileT } from '@/types/media'

/**
 * The „Oznacz jako rzut" affordance for an already-stored gallery.
 *
 * The marked ids are held locally on top of `files` because the server row does not refresh until
 * the revalidation lands — without it the button would keep offering „Oznacz" on a file that is
 * already oznaczony, which reads as a click that did nothing.
 */
export function usePlanMarker(files: MediaFileT[]) {
  const [markedIds, setMarkedIds] = useState<number[]>([])

  const isMarked = (file: PreviewFileT) =>
    file.id !== undefined &&
    (markedIds.includes(file.id) ||
      files.find((candidate) => candidate.id === file.id)?.kind === 'projekt')

  // The try/catch is the point of the wrapper: the caller fires this from an onClick with nowhere
  // to put a rejection, so a transport-level throw (expired cookie, deploy skew, offline) would
  // otherwise be an unhandled rejection and the click would read as a no-op.
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
      toastMessage('Nie udało się oznaczyć pliku — spróbuj ponownie.', 'error')
      return
    }

    setMarkedIds((current) => [...current, id])
    toastMessage('Plik oznaczony jako rzut', 'success')
  }

  return {
    isMarked,
    onMark: (file: PreviewFileT) => void mark(file),
    label: 'Oznacz jako rzut',
    markedLabel: 'Oznaczony jako rzut',
  }
}
