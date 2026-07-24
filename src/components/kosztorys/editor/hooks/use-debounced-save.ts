'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createSaveLanes } from '@/lib/kosztorys/save-lanes'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

// Debounced background save, keyed per field. The UI updates local state immediately
// (outside this hook); here we only fire the action after the input goes quiet. On error =
// toast + optional onError (revert-on-error: the parent rolls the optimistic edit back to its pre-save state).
//
// Every write — debounced forward save AND an undo's immediate inverse (`runNow`) — is dispatched onto a
// per-key serialized lane, so writes to the same cell can never overlap. That is what lets an undo's
// inverse write reliably land *after* an in-flight forward save instead of racing it (EX-526 #1).
export function useDebouncedSave(delay = 500) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const lanesRef = useRef<ReturnType<typeof createSaveLanes> | null>(null)
  lanesRef.current ??= createSaveLanes()
  const lanes = lanesRef.current

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  // Enqueue a write on the key's lane, toasting + reverting on failure (logical or thrown — the lane
  // catches both). Returns the promise for this write settling.
  const dispatch = useCallback(
    (key: string, run: () => Promise<ActionResultT>, onError?: () => void) =>
      lanes.enqueue(key, run, (message) => {
        toastMessage(message, 'error', 5000)
        onError?.()
      }),
    [lanes],
  )

  const save = useCallback(
    (key: string, run: () => Promise<ActionResultT>, onError?: () => void) => {
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        // Drop the fired timer so `cancel` never inspects a dead entry and the map can't grow across
        // a session. Guard on identity: a `save` for the same key mid-flight may have replaced it.
        if (timers.current.get(key) === t) timers.current.delete(key)
        void dispatch(key, run, onError)
      }, delay)
      timers.current.set(key, t)
    },
    [delay, dispatch],
  )

  // Drop a key's pending timer so an undo can pre-empt a not-yet-fired debounced save.
  const cancel = useCallback((key: string) => {
    const existing = timers.current.get(key)
    if (existing) {
      clearTimeout(existing)
      timers.current.delete(key)
    }
  }, [])

  // Fire a write immediately, cancelling any pending debounced save for the key first. The lane still
  // serializes it behind an already-in-flight forward save (which `cancel` can't stop), so an undo's
  // inverse write can't be overwritten by a slower forward one. Returns the settle promise.
  const runNow = useCallback(
    (key: string, run: () => Promise<ActionResultT>, onError?: () => void) => {
      cancel(key)
      return dispatch(key, run, onError)
    },
    [cancel, dispatch],
  )

  return { save, cancel, runNow }
}
