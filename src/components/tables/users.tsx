'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import type { UserRowT } from '@/types/table-rows'
import { formatPLN } from '@/lib/utils/format-currency'
import { RoleBadge } from '@/components/ui/badge'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { HintedValue } from '@/components/tables/hinted-value'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import type { WorkerColumnFiguresT } from '@/lib/kosztorys/worker-payout-pairs'
import { cn } from '@/lib/utils/cn'
import { TrashWorkerButton } from '@/components/users/trash-worker-button'

const col = createColumnHelper<UserRowT>()

const PAYOUT_LINES = [
  { label: 'do zapłaty aktywne', bucket: 'active', kind: 'owed', className: undefined },
  {
    label: 'do zapłaty zakończone',
    bucket: 'completed',
    kind: 'owed',
    className: 'text-muted-foreground',
  },
  { label: 'nadpłata aktywne', bucket: 'active', kind: 'overpaid', className: 'text-destructive' },
  {
    label: 'nadpłata zakończone',
    bucket: 'completed',
    kind: 'overpaid',
    className: 'text-muted-foreground',
  },
] as const

// Four figures, never netted: a nadpłata on one investment is not a discount on another. A withheld
// pair has no figure at all, so it is only counted.
function PayoutRemainingCell({
  view,
  onSettle,
}: {
  view: WorkerColumnFiguresT | undefined
  onSettle: () => void
}) {
  if (!view) return <span className="text-muted-foreground">—</span>
  const lines = PAYOUT_LINES.map((line) => {
    const bucket = view[line.bucket]
    const count = line.kind === 'owed' ? bucket.owedCount : bucket.overpaidCount
    return { ...line, count, amount: bucket[line.kind] }
  }).filter((line) => line.count > 0)
  const withheldCount = view.active.withheldCount + view.completed.withheldCount
  return (
    <span className="inline-flex flex-col items-end">
      {/* The withheld hint stays outside: its tooltip trigger is a button of its own. */}
      <Button variant="link" className="h-auto flex-col items-end gap-0 p-0" onClick={onSettle}>
        {lines.length === 0 ? (
          <span className="text-chart-green">{formatPLN(0)}</span>
        ) : (
          lines.map((line) => (
            <span key={line.label} className={cn('font-normal', line.className)}>
              {line.label} ({line.count}): {formatPLN(line.amount)}
            </span>
          ))
        )}
      </Button>
      {withheldCount > 0 && (
        <HintedValue
          hint={
            <LabelHintIcon
              variant="planeUnconfirmed"
              content="Na tych inwestycjach ten pracownik ma etap z wykonaną pracą bez ustawionego rozliczenia, więc jego należne nie jest znane — nie wchodzi do kwot obok."
            />
          }
        >
          <span className="text-muted-foreground text-xs">
            {withheldCount} bez rozliczenia etapu
          </span>
        </HintedValue>
      )}
    </span>
  )
}

type UserColumnOptionsT = {
  onToggle: (id: number, newActive: boolean) => void
  onSettle: (worker: UserRowT) => void
}

export function getUserColumns({ onToggle, onSettle }: UserColumnOptionsT) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Imię i nazwisko',
    }),
    col.accessor('role', {
      id: 'role',
      header: 'Rola',
      cell: (info) => {
        const role = info.getValue()
        return <RoleBadge role={role}>{ROLE_LABELS[role].pl}</RoleBadge>
      },
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      meta: { align: 'right' },
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue()}
          onToggle={onToggle}
        />
      ),
    }),
    col.accessor(
      (row) =>
        row.payoutRemaining && row.payoutRemaining.active.owed + row.payoutRemaining.completed.owed,
      {
        id: 'payoutRemaining',
        sortUndefined: 'last',
        header: SUBCONTRACTOR_FIGURE_LABELS.remaining,
        meta: { align: 'right' },
        cell: (info) => (
          <PayoutRemainingCell
            view={info.row.original.payoutRemaining}
            onSettle={() => onSettle(info.row.original)}
          />
        ),
      },
    ),
    col.accessor('defaultCashRegisterName', {
      id: 'defaultCashRegister',
      header: 'Domyślna kasa',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) =>
        info.row.original.canTrash && (
          <div className="flex items-center justify-end gap-1">
            <TrashWorkerButton worker={info.row.original} />
          </div>
        ),
    }),
  ]
}
