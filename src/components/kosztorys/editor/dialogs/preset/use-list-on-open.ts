'use client'

import { useEffect, useState } from 'react'
import type { ActionResultT } from '@/types/action'
import { toastMessage } from '@/lib/utils/toast'

// Fetch-on-open for the dialogs opened programmatically (from the „Opcje" / „Dodaj" menus, bypassing
// Radix's own trigger), so the `open` prop is the one reliable seam. `null` = not yet loaded, distinct
// from `[]` = loaded-but-empty, so an empty state never flashes mid-fetch and a failed load isn't
// mistaken for a genuinely empty library.
//
// Resetting to `null` is the CALLER's job, in its own close handler — a synchronous setState in an
// effect body is the cascading-render smell the lint forbids, and each dialog has other state to
// reset in the same place anyway.
//
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
    // A close-then-reopen while the first load is in flight would otherwise resolve into the reset
    // state — showing a stale list, or toasting an error at a dialog nobody is looking at.
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      setItems([])
      toastMessage(message, 'error', 4000)
    }
    void load()
      .then((res) => {
        if (stale) return
        if (res.success) setItems(res.data)
        else fail(res.error ?? failMessage)
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this the loading
      // line hangs forever on a dropped request.
      .catch(() => fail(failMessage))
    return () => {
      stale = true
    }
  }, [open, load, failMessage])

  return { items, reset: () => setItems(null) }
}
