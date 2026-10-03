'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import { useAutoSnapshot } from '@/components/kosztorys/editor/hooks/use-auto-snapshot'
import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'
import { useUndoRedo } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { OnTreeReplacedT } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { refreshDataAction } from '@/lib/actions/refresh'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import { whenOnline } from '@/lib/utils/when-online'

type PropsT = KosztorysEditorDataT

// Thin shell around the stateful editor body: owns the auto-snapshot interval, the "Wersje"
// drawer, and the restore-driven remount. Each of them lives here so a restore's
// body remount doesn't disturb them.
export function KosztorysEditorV2(props: PropsT) {
  const { investmentId, tree, investmentName } = props
  const router = useRouter()
  // One undo/redo stack per editor mount, passed to the body as a prop. It outlives the body's
  // restore remount (the shell doesn't remount), so a restore must reset() it — the stale commands
  // close over the unmounted body's setRows/refs.
  const undoRedo = useUndoRedo()
  const [versionsOpen, setVersionsOpen] = useState(false)
  // The latch's freshness token. `revision` (investment.updatedAt) alone answers a restore and an
  // import — both bump it — but not a row deleted in ANOTHER tab, which changes nothing on the
  // investment and is one of the ways a write comes back NOT_FOUND. The item and section counts close
  // that half — a sekcja bez pozycji moves only the second.
  const treeToken = `${tree.revision}:${tree.sections.length}:${tree.sections.reduce((n, section) => n + section.items.length, 0)}`
  const { remountKey, triggerRestore } = useRestoreRemount(treeToken)

  // Live stack revision for the interval closure (which captures values at setup time, so it can't
  // read the render-fresh `undoRedo.revision`). The eslint rule is too strict for this "latest value"
  // ref write — same sanctioned use as use-kosztorys-editor.ts.
  const revisionRef = useRef(undoRedo.revision)
  // eslint-disable-next-line react-hooks/refs
  revisionRef.current = undoRedo.revision
  const autoSnapshot = useAutoSnapshot(investmentId, revisionRef)

  function reseed(since?: string) {
    triggerRestore(since)
    // Reseeding the whole grid via a body remount — drop the stack whose commands close over
    // the outgoing body's state.
    undoRedo.reset()
    // The incoming tree is a known-good baseline, not a user edit — don't let the next tick snapshot it.
    autoSnapshot.skipNext()
  }

  // Runs in the action's continuation, by which point the action's own render may already have
  // committed — so the latch is armed from `treeToken` as this closure saw it, the tree from before
  // the action.
  const handleTreeReplaced: OnTreeReplacedT = ({ refetch } = {}) => {
    reseed(treeToken)
    if (refetch) whenOnline(() => router.refresh())
  }

  // Recovery from the other direction: the tree was replaced somewhere ELSE (another tab, another
  // session), so this editor learns of it only when a write comes back NOT_FOUND. Same reseed as a
  // restore, and deliberately through the same latch: the fresh tree arrives as a router transition
  // whose commit can't be awaited, so a remount fired from the action's continuation would render
  // BEFORE that pending transition and reseed the body from the tree it already holds. Arming first
  // and letting the prop landing drive the remount has no such ordering to get wrong.
  // `refreshDataAction` is the sidebar's „Odśwież dane" — data, not the page.
  function handleStaleTree() {
    reseed()
    return refreshDataAction()
  }

  return (
    <>
      <KosztorysEditorBody
        key={remountKey}
        {...props}
        undoRedo={undoRedo}
        onOpenVersions={() => setVersionsOpen(true)}
        onTreeReplaced={handleTreeReplaced}
        onStaleTree={handleStaleTree}
      />
      <KosztorysVersionsDrawer
        investmentId={investmentId}
        investmentName={investmentName}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={handleTreeReplaced}
      />
    </>
  )
}
