'use client'

import { useEffect, useRef } from 'react'
import { readKosztorysRevision } from '@/lib/queries/kosztorys-revision'

type ArgsT = {
  investmentId: number
  // The revision the tree on screen was rendered from.
  revision: string
  enabled: boolean
  onChanged: () => void
}

// A plain cell edit never bumps the revision, so a mismatch on return to the tab is a structural write
// or an accepted report from another window — the one moment the grid is known to be stale.
export function useExternalChangeReload({ investmentId, revision, enabled, onChanged }: ArgsT) {
  const renderedRef = useRef(revision)

  renderedRef.current = revision
  // This window's own accept moves the revision before the route re-render brings it in.
  const adoptedRef = useRef<string | undefined>(undefined)
  const onChangedRef = useRef(onChanged)

  onChangedRef.current = onChanged

  useEffect(() => {
    if (!enabled) return
    let isChecking = false
    // focus and visibilitychange both fire on a tab switch; one probe answers both.
    const check = async () => {
      if (isChecking || document.visibilityState !== 'visible') return
      isChecking = true
      try {
        const current = await readKosztorysRevision(investmentId)
        if (current === undefined) return
        if (current !== renderedRef.current && current !== adoptedRef.current) {
          adoptedRef.current = current
          onChangedRef.current()
        }
      } catch {
        // A failed probe is not a change; the next focus asks again.
      } finally {
        isChecking = false
      }
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled, investmentId])

  return {
    adoptRevision: (next: string) => {
      adoptedRef.current = next
    },
  }
}
