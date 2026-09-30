'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { useSnapshotList } from '@/components/kosztorys/editor/hooks/use-snapshot-list'
import { restoreSnapshotAction, type SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { pluralize } from '@/lib/utils/polish-plural'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import type { OnTreeReplacedT } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

type PropsT = {
  investmentId: number
  investmentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: OnTreeReplacedT
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
    const replaced = await settleTreeReplace(
      () => restoreSnapshotAction(snapshot.id, investmentId),
      'Przywracanie przerwane — odświeżam kosztorys',
      ({ data }) => {
        // A warning, not a success, when assignments were dropped: the restore moved money the owner
        // did not ask to move — należne recorded for a since-deleted person now sits in „Bez
        // przypisanego pracownika". Their name can't be shown; the row they were on is gone from `users`.
        const dropped = data.droppedWorkerAssignments
        if (dropped > 0) {
          toastMessage(
            // The count is per etap, not per person — n etapy may have named one deleted worker or n
            // of them — so the cause clause stays number-free rather than asserting a headcount it
            // doesn't know.
            `Przywrócono wersję. ${dropped} ${pluralize(dropped, ['etap', 'etapy', 'etapów'])} bez przypisania — nie odtworzono przypisań do usuniętych pracowników.`,
            'warning',
            8000,
          )
        } else {
          toastMessage('Przywrócono wersję', 'success')
        }
      },
    )
    setRestoringId(null)
    if (!replaced) return
    onOpenChange(false)
    resetSnapshots()
    onRestored(replaced)
  }

  const named = snapshots?.filter((s) => s.kind === 'manual' || s.kind === 'named') ?? []
  const auto = snapshots?.filter((s) => s.kind === 'auto' || s.kind === 'daily') ?? []

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
            {named.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  Nazwane wersje
                </h3>
                {named.map((s) => (
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
        description="Obecny stan zostanie zapisany jako punkt przywracania. Wraca sama rozpiska — rabat globalny, sposób rozliczenia i stawka materiałów zostają dzisiejsze."
        confirmLabel="Przywróć"
        variant="neutral"
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
          {primary
            ? formatPLDateTime(snapshot.takenAt)
            : snapshot.kind === 'daily'
              ? 'Koniec dnia'
              : 'Auto'}
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
