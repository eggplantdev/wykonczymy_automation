'use client'

import { useEffect, useState } from 'react'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type LoadResultT<T> = { success: true; data: T } | { success: false; error?: string }

/**
 * Fetch-on-open for a dialog opened from a grid menu — `open` is the only reliable seam (see
 * `use-list-on-open` for the same reasoning on a list). Unlike that hook, a failed load CLOSES the
 * dialog: what it shows or overwrites comes from this read, so there is no degraded shape to render.
 *
 * `load` must be stable (a server function, not an inline closure) — it is an effect dependency.
 */
export function useLoadOnOpen<A, T>(
  load: (arg: A) => Promise<LoadResultT<T>>,
  arg: A,
  open: boolean,
  onOpenChange: (open: boolean) => void,
  failMessage: string,
): T | null {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (!open) return
    // A close-then-reopen mid-flight would otherwise resolve into the reset state, or toast at a
    // dialog nobody is looking at.
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      toastMessage(message, 'error', 4000)
      onOpenChange(false)
    }
    void settleAction(() => load(arg)).then((res) => {
      if (stale) return
      if (!res.success) return fail(res.error ?? failMessage)
      setData(res.data)
    })
    return () => {
      stale = true
    }
  }, [load, arg, open, onOpenChange, failMessage])

  return data
}
