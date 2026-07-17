'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyKosztorysDialog } from '@/components/kosztorys/empty-kosztorys-dialog'
import { KosztorysEditorBody } from '@/components/kosztorys/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/kosztorys-versions-drawer'
import { UndoRedoContext, useUndoRedo } from '@/components/kosztorys/use-undo-redo'
import { snapshotAction } from '@/lib/actions/kosztorys-snapshots'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// S-06 durable net: while the editor is open, take an auto snapshot on a plain interval, gated on the
// undo-stack revision (S-07) so an idle editor stops writing identical snapshots. The count cap +
// daily GC still bound the table.
const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

type PropsT = { investmentId: number; tree: KosztorysTreeT; investmentName: string }

// Thin shell around the stateful editor body: owns the periodic snapshot interval, the "Wersje"
// drawer, and the restore-driven remount. A restore reseeds the WHOLE grid, so it remounts the body
// (fresh `key`) — a full remount is what restore wants (it intentionally discards
// sort/filter/optimistic state), unlike an ordinary edit which patches rows in place (lessons.md:
// never remount on a routine tree change).
export function KosztorysEditorV2({ investmentId, tree, investmentName }: PropsT) {
  const router = useRouter()
  // One undo/redo stack per editor mount, shared with the body via context. It outlives the body's
  // restore remount (the shell doesn't remount), so a restore must reset() it — the stale commands
  // close over the unmounted body's setRows/refs.
  const undoRedo = useUndoRedo()
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [remountKey, setRemountKey] = useState(0)
  // One-shot remount signal. After a restore we router.refresh() for the restored tree, then remount
  // ONLY once the fresh prop actually lands — keyed on the server revision token (investment.updatedAt),
  // which a restore always bumps, rather than on the `tree` prop's object identity (router.refresh
  // reshapes that on every refresh, so a restore returning an identical-content tree would never fire
  // an identity compare, leaving the latch stuck). restorePending gates it so the routine totals-refresh
  // an ordinary edit triggers doesn't remount. No useEffect: this render-phase compare is flash-free.
  const [restorePending, setRestorePending] = useState(false)
  const prevRevision = useRef(tree.revision)
  const prevEmpty = useRef(tree.sections.length === 0)
  // Comparing/advancing the prev-value ref during render is the documented "store info from previous
  // render" pattern (the rule is too strict here) — same sanctioned use as use-kosztorys-editor.ts.
  // eslint-disable-next-line react-hooks/refs
  const revisionChanged = tree.revision !== prevRevision.current
  // eslint-disable-next-line react-hooks/refs
  prevRevision.current = tree.revision
  // A seed-from-preset inserts the whole tree but does NOT write the investment row, so `revision`
  // (investment.updatedAt) is unchanged — the empty→populated transition is that path's fresh-tree
  // signal instead.
  // eslint-disable-next-line react-hooks/refs
  const becamePopulated = prevEmpty.current && tree.sections.length > 0
  // eslint-disable-next-line react-hooks/refs
  prevEmpty.current = tree.sections.length === 0
  if (restorePending && (revisionChanged || becamePopulated)) {
    setRestorePending(false)
    setRemountKey((k) => k + 1)
  }

  // Live stack revision for the interval closure (which captures values at setup time, so it can't
  // read the render-fresh `undoRedo.revision`). The eslint rule is too strict for this "latest value"
  // ref write — same sanctioned use as the restore-latch above.
  const revisionRef = useRef(undoRedo.revision)
  // eslint-disable-next-line react-hooks/refs
  revisionRef.current = undoRedo.revision
  // Marker: the revision captured at the last auto-snapshot. A tick snapshots only when the revision
  // moved since (something was edited/undone/redone) — an untouched editor writes nothing.
  const lastSnapshotRevision = useRef(undoRedo.revision)

  // Fire-and-forget periodic auto snapshot; a failed snapshot must never disrupt editing. Lives in
  // the shell so a restore remount doesn't restart the interval.
  useEffect(() => {
    const id = setInterval(() => {
      if (revisionRef.current === lastSnapshotRevision.current) return
      lastSnapshotRevision.current = revisionRef.current
      void snapshotAction(investmentId)
    }, AUTO_SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [investmentId])

  function handleRestored() {
    router.refresh()
    setRestorePending(true)
    // Restore reseeds the whole grid via a body remount — drop the stack whose commands close over
    // the outgoing body's state.
    undoRedo.reset()
    // reset() bumps the revision by one (guarded by the use-undo-redo unit test). The restored tree
    // is a known-good baseline, not a user edit, so advance the marker past that bump — otherwise the
    // next tick would snapshot the just-restored state.
    lastSnapshotRevision.current = revisionRef.current + 1
  }

  return (
    <UndoRedoContext.Provider value={undoRedo}>
      {tree.sections.length === 0 && (
        <EmptyKosztorysDialog investmentId={investmentId} onCreated={handleRestored} />
      )}
      <KosztorysEditorBody
        key={remountKey}
        investmentId={investmentId}
        tree={tree}
        investmentName={investmentName}
        onOpenVersions={() => setVersionsOpen(true)}
      />
      <KosztorysVersionsDrawer
        investmentId={investmentId}
        investmentName={investmentName}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={handleRestored}
      />
    </UndoRedoContext.Provider>
  )
}
