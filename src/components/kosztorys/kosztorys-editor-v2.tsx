'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KosztorysEditorBody } from '@/components/kosztorys/kosztorys-editor-body'
import { KosztorysVersionsDrawer } from '@/components/kosztorys/kosztorys-versions-drawer'
import { SeedFromPresetButton } from '@/components/kosztorys/seed-from-preset-button'
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

  // Fire-and-forget periodic auto snapshot; a failed snapshot must never disrupt editing. Lives in
  // the shell so a restore remount doesn't restart the interval.
  useEffect(() => {
    const id = setInterval(() => void snapshotAction(investmentId), AUTO_SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [investmentId])

  function handleRestored() {
    router.refresh()
    setRestorePending(true)
  }

  return (
    <>
      {tree.sections.length === 0 && (
        <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-md border border-dashed px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Kosztorys jest pusty. Możesz wypełnić go z zapisanego presetu.
          </p>
          <SeedFromPresetButton investmentId={investmentId} onSeeded={handleRestored} />
        </div>
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
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={handleRestored}
      />
    </>
  )
}
