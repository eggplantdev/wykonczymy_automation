'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EditorActionsContext } from '@/components/kosztorys/editor/actions/editor-actions-context'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import { useAutoSnapshot } from '@/components/kosztorys/editor/hooks/use-auto-snapshot'
import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'
import { useUndoRedo } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { OnTreeReplacedT } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { refreshDataAction } from '@/lib/actions/refresh'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import { whenOnline } from '@/lib/utils/when-online'

type PropsT = Omit<KosztorysEditorDataT, 'isTemplate'> & {
  // Required: a szablon id and a kosztorys id share one number space, so the route must say which
  // plane its writes land on.
  actions: EditorActionsT
}

export function KosztorysEditorV2({ actions, ...props }: PropsT) {
  const { investmentId, tree, investmentName } = props
  const router = useRouter()
  const undoRedo = useUndoRedo()
  const [versionsOpen, setVersionsOpen] = useState(false)
  const flushBodySavesRef = useRef(async () => {})
  // `revision` (investment.updatedAt) alone answers a restore and an
  // import — both bump it — but not a row deleted in ANOTHER tab, which changes nothing on the
  // investment
  const treeToken = `${tree.revision}:${tree.sections.length}:${tree.sections.reduce((n, section) => n + section.items.length, 0)}`
  const [isRefreshing, startRefresh] = useTransition()
  const { remountKey, triggerRestore } = useRestoreRemount(treeToken, isRefreshing)

  // Live stack revision for the interval closure (which captures values at setup time, so it can't
  // read the render-fresh `undoRedo.revision`).
  const revisionRef = useRef(undoRedo.revision)
  // eslint-disable-next-line react-hooks/refs
  revisionRef.current = undoRedo.revision
  const autoSnapshot = useAutoSnapshot(investmentId, revisionRef, actions.autoSnapshot)

  function reseed(since?: string, ownsRefresh = false) {
    triggerRestore(since, ownsRefresh)
    // Reseeding the whole grid via a body remount — drop the stack whose commands close over
    // the outgoing body's state.
    undoRedo.reset()
    // The incoming tree is a known-good baseline, not a user edit — don't let the next tick snapshot it.
    autoSnapshot.skipNext()
  }

  // A stale refusal arms from the seed instead: the tree on screen
  // may already hold the other session's change, and waiting for it to move again would never end.
  const handleTreeReplaced: OnTreeReplacedT = ({ refetch = false, stale = false } = {}) => {
    reseed(stale ? undefined : treeToken, refetch)
    if (refetch) whenOnline(() => startRefresh(() => router.refresh()))
  }

  // the fresh tree arrives as a router transition
  // whose commit can't be awaited, so a remount fired from the action's continuation would render
  // BEFORE that pending transition and reseed the body from the tree it already holds.
  function handleStaleTree() {
    reseed()
    return refreshDataAction()
  }

  return (
    <EditorActionsContext value={actions}>
      <KosztorysEditorBody
        key={remountKey}
        {...props}
        isTemplate={actions.isTemplate}
        undoRedo={undoRedo}
        onOpenVersions={(flushPendingSaves) => {
          flushBodySavesRef.current = flushPendingSaves
          setVersionsOpen(true)
        }}
        onTreeReplaced={handleTreeReplaced}
        onStaleTree={handleStaleTree}
      />
      <KosztorysVersionsDrawer
        investmentId={investmentId}
        investmentName={investmentName}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={handleTreeReplaced}
        flushPendingSaves={() => flushBodySavesRef.current()}
      />
    </EditorActionsContext>
  )
}
