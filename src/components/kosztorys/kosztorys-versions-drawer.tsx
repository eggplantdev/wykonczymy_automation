'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  investmentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called after a successful restore so the parent can refresh + remount the editor.
  onRestored: () => void
}

// History panel: named manual versions are the prominent targetable entries; auto snapshots are the
// ambient timestamped history below them. Restore gates behind a ConfirmDialog — the pre-restore auto
// snapshot the action takes makes a mis-restore itself recoverable.
export function KosztorysVersionsDrawer({
  investmentId,
  investmentName,
  open,
  onOpenChange,
  onRestored,
}: PropsT) {
  // null = not loaded yet (spinner); [] = loaded, empty.
  const [snapshots, setSnapshots] = useState<SnapshotListItemT[] | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [pendingRestore, setPendingRestore] = useState<SnapshotListItemT | null>(null)

  // Fetch is keyed on the `open` prop, deliberately NOT on a click handler, because this drawer never
  // sees the click: `open` is controlled by the parent toolbar, so the opening click happens up there.
  // Radix can't help either — a controlled Dialog with no internal <Dialog.Trigger> fires onOpenChange
  // only on dismiss (Escape/overlay → `false`), never with `true` on the programmatic open. Keying on
  // the visibility *state* (not a DOM event) also means the fetch fires for EVERY path that opens the
  // drawer — today the toolbar, tomorrow a programmatic open (e.g. auto-open after a restore) — which a
  // trigger-click handler would silently miss. `active` drops a response that lands after a close/reopen
  // so a stale fetch can't populate the reopened list.
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
    setPendingRestore(null)
    setRestoringId(snapshot.id)
    const res = await restoreSnapshotAction(snapshot.id, investmentId)
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
                    investmentName={investmentName}
                    primary
                    restoring={restoringId === s.id}
                    onRestore={() => setPendingRestore(s)}
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
                    investmentName={investmentName}
                    restoring={restoringId === s.id}
                    onRestore={() => setPendingRestore(s)}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={pendingRestore != null}
        title={
          pendingRestore ? `Przywrócić wersję z ${formatPLDateTime(pendingRestore.takenAt)}?` : ''
        }
        description="Obecny stan zostanie zapisany jako punkt przywracania."
        confirmLabel="Przywróć"
        pending={restoringId != null}
        pendingLabel="Przywracanie…"
        onConfirm={() => pendingRestore && handleRestore(pendingRestore)}
        onCancel={() => setPendingRestore(null)}
      />
    </Dialog>
  )
}

function SnapshotRow({
  snapshot,
  investmentName,
  primary,
  restoring,
  onRestore,
}: {
  snapshot: SnapshotListItemT
  investmentName: string
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
          {` · ${investmentName}`}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onRestore} disabled={restoring}>
        {restoring ? 'Przywracanie…' : 'Przywróć'}
      </Button>
    </div>
  )
}
