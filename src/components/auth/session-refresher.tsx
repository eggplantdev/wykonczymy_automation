'use client'

import { useEffect, useRef } from 'react'
import { refreshSessionAction } from '@/lib/actions/session-refresh'
import { settleAction } from '@/lib/utils/settle-action'

// Setting the cookie from a Server Action re-renders the current route — accepted at one slide a day.
export function SessionRefresher() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void settleAction(refreshSessionAction)
  }, [])

  return null
}
