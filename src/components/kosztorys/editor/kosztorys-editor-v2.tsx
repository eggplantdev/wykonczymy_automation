'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import { useAutoSnapshot } from '@/components/kosztorys/editor/hooks/use-auto-snapshot'
import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'
import { useUndoRedo } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import { useWorkshopMirrorFlush } from '@/components/kosztorys/editor/hooks/use-workshop-mirror-flush'
import { refreshDataAction } from '@/lib/actions/refresh'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'

type PropsT = KosztorysEditorDataT

// Thin shell around the stateful editor body: owns the auto-snapshot interval, the szablon mirror
// flush, the "Wersje" drawer, and the restore-driven remount. Each of them lives here so a restore's
// body remount doesn't disturb them.
export function KosztorysEditorV2(props: PropsT) {
  const { investmentId, tree, investmentName, templatePresetId } = props
  const router = useRouter()
  // One undo/redo stack per editor mount, passed to the body as a prop. It outlives the body's
  // restore remount (the shell doesn't remount), so a restore must reset() it — the stale commands
  // close over the unmounted body's setRows/refs.
  const undoRedo = useUndoRedo()
  const [versionsOpen, setVersionsOpen] = useState(false)
  // The latch's freshness token. `revision` (investment.updatedAt) alone answers a restore and an
  // import — both bump it — but not a row deleted in ANOTHER tab, which changes nothing on the
  // investment and is one of the ways a write comes back NOT_FOUND. The item count closes that half.
  const treeToken = `${tree.revision}:${tree.sections.reduce((n, section) => n + section.items.length, 0)}`
  const { remountKey, triggerRestore } = useRestoreRemount(treeToken)

  // Live stack revision for the interval closure (which captures values at setup time, so it can't
  // read the render-fresh `undoRedo.revision`). The eslint rule is too strict for this "latest value"
  // ref write — same sanctioned use as use-kosztorys-editor.ts.
  const revisionRef = useRef(undoRedo.revision)
  // eslint-disable-next-line react-hooks/refs
  revisionRef.current = undoRedo.revision
  const autoSnapshot = useAutoSnapshot(investmentId, revisionRef)
  // In the shell, not the body: the body remounts on a version restore, and the flush on unmount
  // has to mean „I left the workbench", not „I loaded a different version".
  useWorkshopMirrorFlush(templatePresetId, revisionRef)

  // Shared by every path that swaps the whole tree under the editor — restoring a version and
  // importing the Google sheet both land here.
  function handleTreeReplaced() {
    router.refresh()
    triggerRestore()
    // Reseeding the whole grid via a body remount — drop the stack whose commands close over
    // the outgoing body's state.
    undoRedo.reset()
    // The incoming tree is a known-good baseline, not a user edit — don't let the next tick snapshot it.
    autoSnapshot.skipNext()
  }

  // Recovery from the other direction: the tree was replaced somewhere ELSE (another tab, another
  // session), so this editor learns of it only when a write comes back NOT_FOUND. Same reseed as a
  // restore, and deliberately through the same latch: the fresh tree arrives as a router transition
  // whose commit can't be awaited, so a remount fired from the action's continuation would render
  // BEFORE that pending transition and reseed the body from the tree it already holds. Arming first
  // and letting the prop landing drive the remount has no such ordering to get wrong.
  // `refreshDataAction` is the sidebar's „Odśwież dane" — data, not the page.
  function handleStaleTree() {
    triggerRestore()
    undoRedo.reset()
    autoSnapshot.skipNext()
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
