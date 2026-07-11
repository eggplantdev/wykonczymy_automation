'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KosztorysEditorBody } from '@/components/kosztorys/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/kosztorys-versions-drawer'
import { snapshotAction } from '@/lib/actions/kosztorys-snapshots'
import type { KosztorysTreeT } from '@/types/kosztorys'

// S-06 durable net: while the editor is open, take an auto snapshot on a plain interval. Dumb by
// design — no dirty/activity check (deferred to S-07); the count cap + daily GC bound the table.
const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

type PropsT = { investmentId: number; tree: KosztorysTreeT; investmentName: string }

// Thin shell around the stateful editor body: owns the periodic snapshot interval, the "Wersje"
// drawer, and the restore-driven remount. A restore reseeds the WHOLE grid, so it remounts the body
// (fresh `key`) — a full remount is what restore wants (it intentionally discards
// sort/filter/optimistic state), unlike an ordinary edit which patches rows in place (lessons.md:
// never remount on a routine tree change).
export function KosztorysEditorV2({ investmentId, tree, investmentName }: PropsT) {
  const router = useRouter()
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [remountKey, setRemountKey] = useState(0)
  // One-shot remount signal. After a restore we router.refresh() for the restored tree, then remount
  // ONLY once the fresh prop actually lands — comparing the `tree` prop across renders fires the
  // remount on the first change while a restore is pending, without a useEffect and without
  // remounting on the routine totals-refresh that ordinary edits trigger (awaitingTree gates it).
  const [awaitingTree, setAwaitingTree] = useState(false)
  const prevTree = useRef(tree)
  // Comparing/advancing the prev-prop ref during render is the documented "store info from previous
  // render" pattern (the rule is too strict here) — same sanctioned use as use-kosztorys-editor.ts.
  // eslint-disable-next-line react-hooks/refs
  const treeChanged = tree !== prevTree.current
  // eslint-disable-next-line react-hooks/refs
  prevTree.current = tree
  if (awaitingTree && treeChanged) {
    setAwaitingTree(false)
    setRemountKey((k) => k + 1)
  }

  // Fire-and-forget periodic auto snapshot; a failed snapshot must never disrupt editing. Lives in
  // the shell so a restore remount doesn't restart the interval.
  useEffect(() => {
    const id = setInterval(() => void snapshotAction(investmentId), AUTO_SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [investmentId])

  function handleRestored() {
    router.refresh()
    setAwaitingTree(true)
  }

  function handleVersionsOpenChange(open: boolean) {
    setVersionsOpen(open)
    // Drop a pending remount latch on close. If a restore's refresh returned a referentially
    // identical tree, `treeChanged` never fired and `awaitingTree` would stay stuck true — then a
    // later ordinary edit's refresh would wrongly remount mid-edit. An identical tree means there is
    // nothing to remount for, so clearing here loses no real restore.
    if (!open) setAwaitingTree(false)
  }

  return (
    <>
      <KosztorysEditorBody
        key={remountKey}
        investmentId={investmentId}
        tree={tree}
        investmentName={investmentName}
        onOpenVersions={() => setVersionsOpen(true)}
      />
      <KosztorysVersionsDrawer
        investmentId={investmentId}
        open={versionsOpen}
        onOpenChange={handleVersionsOpenChange}
        onRestored={handleRestored}
      />
    </>
  )
}
