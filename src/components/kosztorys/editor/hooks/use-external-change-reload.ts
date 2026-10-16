'use client'

import { useEffect, useRef } from 'react'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'

type ArgsT = {
  investmentId: number
  revision: string
  enabled: boolean
  onChanged: () => void
}

export function useExternalChangeReload({ investmentId, revision, enabled, onChanged }: ArgsT) {
  const { readRevision } = useEditorActions()
  const renderedRef = useRef(revision)

  renderedRef.current = revision
  // This window's own accept moves the revision before the route re-render brings it in.
  const adoptedRef = useRef<string | undefined>(undefined)
  const onChangedRef = useRef(onChanged)

  onChangedRef.current = onChanged

  useEffect(() => {
    if (!enabled) return
    let isChecking = false
    const check = async () => {
      if (isChecking || document.visibilityState !== 'visible') return
      isChecking = true
      try {
        const current = await readRevision(investmentId)
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
  }, [enabled, investmentId, readRevision])

  return {
    adoptRevision: (next: string) => {
      adoptedRef.current = next
    },
  }
}
