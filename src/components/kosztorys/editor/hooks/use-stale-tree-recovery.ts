'use client'

import { useRef } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionErrorCodeT } from '@/types/action'

const STALE_TREE_MESSAGE = 'Kosztorys zmienił się w innym miejscu — odświeżam dane.'
const STALE_TREE_NO_RESEED = 'Kosztorys zmienił się w innym miejscu — odśwież stronę.'
const STALE_TREE_FAILED =
  'Kosztorys zmienił się w innym miejscu, a odświeżenie nie powiodło się — odśwież stronę.'

type StaleTreeRecoveryT = {
  recoverStaleTree: () => void
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

// The grid seeds its rows once at mount, so without this it keeps writing to dead ids forever and
// the user gets one bare „Nie znaleziono" per keystroke.
export function useStaleTreeRecovery(onStaleTree?: () => Promise<unknown>): StaleTreeRecoveryT {
  const recovering = useRef(false)

  function recoverStaleTree() {
    if (recovering.current) return
    recovering.current = true
    if (!onStaleTree) {
      toastMessage(STALE_TREE_NO_RESEED, 'warning', 8000)
      recovering.current = false
      return
    }
    toastMessage(STALE_TREE_MESSAGE, 'warning', 8000)
    onStaleTree()
      .catch(() => toastMessage(STALE_TREE_FAILED, 'error', 8000))
      .finally(() => {
        recovering.current = false
      })
  }

  return {
    recoverStaleTree,
    reportFailure: (error, code) => {
      if (code === 'NOT_FOUND') return recoverStaleTree()
      toastMessage(error, 'error', 5000)
    },
  }
}
