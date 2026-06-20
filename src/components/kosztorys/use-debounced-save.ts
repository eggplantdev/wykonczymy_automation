'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

// Debounced zapis w tle per klucz pola. UI aktualizuje stan lokalny natychmiast
// (poza tym hookiem); tu tylko strzelamy akcję po ciszy. Błąd = toast + opcjonalny
// onError (revert-on-error: rodzic cofa optymistyczną edycję do stanu sprzed zapisu).
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
