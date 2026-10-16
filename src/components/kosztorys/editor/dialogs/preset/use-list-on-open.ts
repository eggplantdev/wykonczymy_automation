'use client'

import { useEffect, useState } from 'react'
import type { ActionResultT } from '@/types/action'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

// `load` must be a module-level server action, not an inline closure: it is not an effect dep, so a
// per-render arrow would silently pin the first render's captured values.
export function useListOnOpen<T>(
  open: boolean,
  load: () => Promise<ActionResultT<T[]>>,
  failMessage: string,
) {
  const [items, setItems] = useState<T[] | null>(null)

  useEffect(() => {
    if (!open) return
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      setItems([])
      toastMessage(message, 'error', 4000)
    }
    void settleAction(load).then((res) => {
      if (stale) return
      if (res.success) setItems(res.data)
      else fail(res.error ?? failMessage)
    })
    return () => {
      stale = true
    }
  }, [open, load, failMessage])

  return { items, reset: () => setItems(null) }
}
