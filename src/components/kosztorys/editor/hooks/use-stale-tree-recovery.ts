'use client'

import { useRef } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionErrorCodeT } from '@/types/action'

const STALE_TREE_MESSAGE = 'Kosztorys zmienił się w innym miejscu — odświeżam dane.'
const STALE_TREE_NO_RESEED = 'Kosztorys zmienił się w innym miejscu — odśwież stronę.'
const STALE_TREE_FAILED =
  'Kosztorys zmienił się w innym miejscu, a odświeżenie nie powiodło się — odśwież stronę.'

type StaleTreeRecoveryT = {
  // Reseed the grid from the server. Idempotent while a reseed is in flight.
  recoverStaleTree: () => void
  // The one place a failed editor action becomes something the user can see: a stale tree reseeds,
  // everything else toasts. No caller may swallow a failure by returning early.
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

/**
 * Recovery for the failure the editor cannot revert its way out of: the row a write targeted is gone,
 * because the tree was replaced elsewhere (a sheet import or a version restore in another tab — both
 * wipe-and-reinsert, so every id changes). The grid seeds its rows once at mount (EX-441), so without
 * this it keeps writing to dead ids forever and the user gets one bare „Nie znaleziono" per keystroke.
 *
 * Data, not the page: `onStaleTree` (the shell) re-reads the tree and reseeds the grid in place. The
 * optimistic edits that never landed are lost by design — they were written against a tree that no
 * longer exists.
 */
export function useStaleTreeRecovery(onStaleTree?: () => Promise<unknown>): StaleTreeRecoveryT {
  const recovering = useRef(false)

  function recoverStaleTree() {
    // A stale tree fails EVERY pending write, so the burst arrives as a run of identical failures —
    // one reseed answers all of them.
    if (recovering.current) return
    recovering.current = true
    // The read-only client body has no reseed path; say so instead of pretending to refresh.
    if (!onStaleTree) {
      toastMessage(STALE_TREE_NO_RESEED, 'warning', 8000)
      recovering.current = false
      return
    }
    // Announced up front, not on the promise: the reseed is latched on the fresh tree landing, so
    // „odświeżam" is the truthful tense — and the user is owed the explanation whether or not the
    // fetch behind it succeeds.
    toastMessage(STALE_TREE_MESSAGE, 'warning', 8000)
    onStaleTree()
      // A recovery that fails is the silence this whole change exists to remove: the write's own
      // error was deliberately not toasted (NOT_FOUND takes this path instead), so without this the
      // user is told data is refreshing and then never hears anything again.
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
