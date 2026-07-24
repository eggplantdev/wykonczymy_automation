'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { useSnapshotList } from '@/components/kosztorys/editor/hooks/use-snapshot-list'
import { restoreSnapshotAction, type SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
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
  const { snapshots, reset: resetSnapshots } = useSnapshotList(investmentId, open)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [pendingRestore, setPendingRestore] = useState<SnapshotListItemT | null>(null)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) resetSnapshots()
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
    resetSnapshots()
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
