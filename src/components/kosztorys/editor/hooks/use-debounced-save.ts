'use client'

import { useEffect, useRef, useState } from 'react'
import { createDebouncedSaves, createSaveLanes } from '@/lib/kosztorys/save-lanes'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

// Debounced background save, keyed per field. The UI updates local state immediately
// (outside this hook); here we only fire the action after the input goes quiet. On error =
// toast + optional onError (revert-on-error: the parent rolls the optimistic edit back to its pre-save state).
//
// Every write — debounced forward save AND an undo's immediate inverse (`runNow`) — is dispatched onto a
// per-key serialized lane, so writes to the same cell can never overlap. That is what lets an undo's
// inverse write reliably land *after* an in-flight forward save instead of racing it (EX-526 #1).
export function useDebouncedSave(delay = 500, onStale?: () => void) {
  // Read at failure time, not at dispatch time, so the handler doesn't have to be stable.
  const onStaleRef = useRef(onStale)
  useEffect(() => {
    onStaleRef.current = onStale
  })
  // The ref is read only when a write fails, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [saves] = useState(() => {
    const lanes = createSaveLanes()
    // NOT_FOUND is the one failure that is not about this write: the row is gone, so the grid's whole
    // mount-frozen copy of the tree is stale and every other pending write will fail the same way.
    // Reverting one cell there is theatre — it would restore a value from a tree that no longer exists —
    // so the failure is handed to `onStale`, which reseeds instead, and neither toasts nor reverts here.
    const dispatch = (key: string, run: () => Promise<ActionResultT>, onError?: () => void) =>
      lanes.enqueue(key, run, (message, code) => {
        if (code === 'NOT_FOUND' && onStaleRef.current) {
          onStaleRef.current()
          return
        }
        toastMessage(message, 'error', 5000)
        onError?.()
      })
    return createDebouncedSaves(delay, dispatch, lanes)
  })

  useEffect(() => () => saves.dispose(), [saves])

  return {
    save: saves.save,
    cancel: saves.cancel,
    runNow: saves.runNow,
    drain: saves.drain,
    drainAll: saves.drainAll,
  }
}
