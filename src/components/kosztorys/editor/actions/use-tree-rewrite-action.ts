'use client'

import { useState } from 'react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { FailureT } from '@/types/action'

/**
 * A menu action that rewrites rows of the tree in place. `onDone` returns whether anything changed;
 * when it did, the grid reseeds off the revision token the writer bumped.
 */
export function useTreeRewriteAction<DataT>(
  run: (investmentId: number) => Promise<{ success: true; data: DataT } | FailureT>,
  failedMessage: string,
  onDone: (data: DataT) => boolean,
) {
  const { investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const [pending, setPending] = useState(false)

  function start() {
    setPending(true)
    void settleAction(() => run(investmentId))
      .then((res) => {
        if (!res.success && res.code === 'REQUEST_FAILED') {
          // A request that never completed may still have committed the rewrite; refetch so the
          // grid doesn't autosave the old text back over it.
          toastMessage(`${failedMessage} — odświeżam kosztorys`, 'error')
          return onTreeReplaced?.({ refetch: true })
        }
        if (!res.success) return toastMessage(res.error, 'error')
        if (onDone(res.data)) onTreeReplaced?.()
      })
      .finally(() => setPending(false))
  }

  return { pending, start }
}
