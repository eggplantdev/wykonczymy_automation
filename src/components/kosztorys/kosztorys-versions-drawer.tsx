'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import {
  listSnapshotsAction,
  restoreSnapshotAction,
  type SnapshotListItemT,
} from '@/lib/actions/kosztorys-snapshots'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called after a successful restore so the parent can refresh + remount the editor.
  onRestored: () => void
}

// History panel: named manual versions are the prominent targetable entries; auto snapshots are the
// ambient timestamped history below them. Restore is a single window.confirm (the codebase's
// established destructive-confirm pattern, cf. kosztorys-section-summary) — the pre-restore auto
// snapshot the action takes makes a mis-restore itself recoverable.
export function KosztorysVersionsDrawer({ investmentId, open, onOpenChange, onRestored }: PropsT) {
  // null = not loaded yet (spinner); [] = loaded, empty.
  const [snapshots, setSnapshots] = useState<SnapshotListItemT[] | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  // The drawer opens programmatically (parent toolbar sets `open`), so Radix's onOpenChange never
  // fires with `true` — fetch on the `open` prop, or the list stays stuck on "Wczytywanie…". setState
  // only from the async callback (never synchronously in the effect body): refetches on each open, and
  // `active` drops a response that lands after a close/reopen.
  useEffect(() => {
    if (!open) return
    let active = true
    listSnapshotsAction(investmentId)
      .then((res) => {
        if (!active) return
        if (!res.success) {
          toastMessage(res.error ?? 'Nie udało się wczytać wersji', 'error', 4000)
          setSnapshots([])
          return
        }
        setSnapshots(res.data)
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this the spinner
      // would hang forever on a dropped request.
      .catch(() => {
        if (!active) return
        toastMessage('Nie udało się wczytać wersji', 'error', 4000)
        setSnapshots([])
      })
    return () => {
      active = false
    }
  }, [open, investmentId])

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) setSnapshots(null)
  }

  async function handleRestore(snapshot: SnapshotListItemT) {
    const when = formatPLDateTime(snapshot.takenAt)
    if (
      !window.confirm(
        `Przywrócić wersję z ${when}? Obecny stan zostanie zapisany jako punkt przywracania.`,
      )
    ) {
      return
    }
    setRestoringId(snapshot.id)
    const res = await restoreSnapshotAction(snapshot.id)
    setRestoringId(null)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się przywrócić wersji', 'error', 4000)
      return
    }
    toastMessage('Przywrócono wersję', 'success')
    onOpenChange(false)
    setSnapshots(null)
    onRestored()
  }

  const manual = snapshots?.filter((s) => s.kind === 'manual') ?? []
  const auto = snapshots?.filter((s) => s.kind === 'auto') ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader title="Wersje" description="Zapisane i automatyczne punkty przywracania." />
        {snapshots === null ? (
          <p className="text-muted-foreground text-sm">Wczytywanie…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak zapisanych wersji.</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto">
            {manual.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  Nazwane wersje
                </h3>
                {manual.map((s) => (
                  <SnapshotRow
                    key={s.id}
                    snapshot={s}
                    primary
                    restoring={restoringId === s.id}
                    onRestore={() => handleRestore(s)}
                  />
                ))}
              </section>
            )}
            {auto.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  Historia automatyczna
                </h3>
                {auto.map((s) => (
                  <SnapshotRow
                    key={s.id}
                    snapshot={s}
                    restoring={restoringId === s.id}
                    onRestore={() => handleRestore(s)}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SnapshotRow({
  snapshot,
  primary,
  restoring,
  onRestore,
}: {
  snapshot: SnapshotListItemT
  primary?: boolean
  restoring: boolean
  onRestore: () => void
}) {
  return (
    <div className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <div
          className={`truncate text-sm ${primary ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          {primary ? snapshot.label : formatPLDateTime(snapshot.takenAt)}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {primary ? formatPLDateTime(snapshot.takenAt) : 'Auto'}
          {snapshot.takenByName ? ` · ${snapshot.takenByName}` : ''}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onRestore} disabled={restoring}>
        {restoring ? 'Przywracanie…' : 'Przywróć'}
      </Button>
    </div>
  )
}
