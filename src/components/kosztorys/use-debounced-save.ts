'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

// Debounced background save, keyed per field. The UI updates local state immediately
// (outside this hook); here we only fire the action after the input goes quiet. On error =
// toast + optional onError (revert-on-error: the parent rolls the optimistic edit back to its pre-save state).
export function useDebouncedSave(delay = 500) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  return useCallback(
    (key: string, run: () => Promise<ActionResultT>, onError?: () => void) => {
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      const fail = (msg: string) => {
        toastMessage(msg, 'error', 5000)
        onError?.()
      }
      const t = setTimeout(() => {
        run()
          .then((res) => {
            if (!res.success) fail(res.error)
          })
          .catch((e) => fail(e instanceof Error ? e.message : 'Błąd zapisu'))
      }, delay)
      timers.current.set(key, t)
    },
    [delay],
  )
}
