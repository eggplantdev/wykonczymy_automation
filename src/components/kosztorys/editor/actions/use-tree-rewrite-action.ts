'use client'

import { useState } from 'react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import type { FailureT } from '@/types/action'

export type TreeRewriteActionT = { pending: boolean; start: () => void }

/**
 * A menu action that rewrites rows of the tree in place. `onDone` returns whether anything changed;
 * when it did, the grid reseeds off the revision token the writer bumped.
 */
export function useTreeRewriteAction<DataT>(
  run: (investmentId: number) => Promise<{ success: true; data: DataT } | FailureT>,
  failedMessage: string,
  onDone: (data: DataT) => boolean,
): TreeRewriteActionT {
  const { investmentId, onTreeReplaced, flushPendingSaves } = useKosztorysEditorContext()
  const [pending, setPending] = useState(false)

  async function settle() {
    let changed = false
    const replaced = await settleTreeReplace(
      flushPendingSaves,
      () => run(investmentId),
      `${failedMessage} — odświeżam kosztorys`,
      ({ data }) => {
        changed = onDone(data)
      },
    )
    if (replaced && (replaced.refetch || changed)) onTreeReplaced?.(replaced)
  }

  function start() {
    setPending(true)
    void settle().finally(() => setPending(false))
  }

  return { pending, start }
}
