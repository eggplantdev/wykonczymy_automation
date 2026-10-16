'use client'

import { useEffect, useRef, useState } from 'react'
import { createDebouncedSaves, createSaveLanes } from '@/lib/kosztorys/save-lanes'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

export function useDebouncedSave(delay = 500, onStale?: () => void) {
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
