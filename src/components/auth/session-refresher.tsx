'use client'

import { useEffect, useRef } from 'react'
import { refreshSessionAction } from '@/lib/actions/session-refresh'

/** Slides the session forward once per app open; the new cookie is used by the next request. */
export function SessionRefresher() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void refreshSessionAction()
  }, [])

  return null
}
