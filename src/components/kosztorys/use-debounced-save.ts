'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

// Debounced zapis w tle per klucz pola. UI aktualizuje stan lokalny natychmiast
// (poza tym hookiem); tu tylko strzelamy akcję po ciszy. Błąd = toast.
export function useDebouncedSave(delay = 500) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  return useCallback(
    (key: string, run: () => Promise<ActionResultT>) => {
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        run()
          .then((res) => {
            if (!res.success) toastMessage(res.error, 'error', 5000)
          })
          .catch((e) => toastMessage(e instanceof Error ? e.message : 'Błąd zapisu', 'error', 5000))
      }, delay)
      timers.current.set(key, t)
    },
    [delay],
  )
}
