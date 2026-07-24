'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyKosztorysDialog } from '@/components/kosztorys/editor/dialogs/empty-kosztorys-dialog'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import { useAutoSnapshot } from '@/components/kosztorys/editor/hooks/use-auto-snapshot'
import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'
import { useUndoRedo } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'

type PropsT = KosztorysEditorDataT

// Thin shell around the stateful editor body: owns the auto-snapshot interval, the "Wersje" drawer, and
// the restore-driven remount. Each of the three lives here so a restore's body remount doesn't disturb
// them.
export function KosztorysEditorV2({
  investmentId,
  tree,
  investmentName,
  materialsGross,
  materialyBreakdown,
  wplatyNet,
  laborCostsNetFromTransactions,
  investmentRabat,
  payoutsByWorker = [],
  payoutTransactions = [],
  depositTransactions = [],
  materialTransactions = [],
}: PropsT) {
  const router = useRouter()
  // One undo/redo stack per editor mount, passed to the body as a prop. It outlives the body's
  // restore remount (the shell doesn't remount), so a restore must reset() it — the stale commands
  // close over the unmounted body's setRows/refs.
  const undoRedo = useUndoRedo()
  const [versionsOpen, setVersionsOpen] = useState(false)
  const { remountKey, triggerRestore } = useRestoreRemount(tree)

  // Live stack revision for the interval closure (which captures values at setup time, so it can't
  // read the render-fresh `undoRedo.revision`). The eslint rule is too strict for this "latest value"
  // ref write — same sanctioned use as use-kosztorys-editor.ts.
  const revisionRef = useRef(undoRedo.revision)
  // eslint-disable-next-line react-hooks/refs
  revisionRef.current = undoRedo.revision
  const autoSnapshot = useAutoSnapshot(investmentId, revisionRef)

  function handleRestored() {
    router.refresh()
    triggerRestore()
    // Restore reseeds the whole grid via a body remount — drop the stack whose commands close over
    // the outgoing body's state.
    undoRedo.reset()
    // The restored tree is a known-good baseline, not a user edit — don't let the next tick snapshot it.
    autoSnapshot.skipNext()
  }

  return (
    <>
      {tree.sections.length === 0 && (
        <EmptyKosztorysDialog investmentId={investmentId} onCreated={handleRestored} />
      )}
      <KosztorysEditorBody
        key={remountKey}
        investmentId={investmentId}
        tree={tree}
        investmentName={investmentName}
        materialsGross={materialsGross}
        materialyBreakdown={materialyBreakdown}
        wplatyNet={wplatyNet}
        laborCostsNetFromTransactions={laborCostsNetFromTransactions}
        investmentRabat={investmentRabat}
        payoutsByWorker={payoutsByWorker}
        payoutTransactions={payoutTransactions}
        depositTransactions={depositTransactions}
        materialTransactions={materialTransactions}
        undoRedo={undoRedo}
        onOpenVersions={() => setVersionsOpen(true)}
      />
      <KosztorysVersionsDrawer
        investmentId={investmentId}
        investmentName={investmentName}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={handleRestored}
      />
    </>
  )
}
