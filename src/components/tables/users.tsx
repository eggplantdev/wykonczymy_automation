'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import type { UserRowT } from '@/types/table-rows'
import { formatPLN } from '@/lib/utils/format-currency'
import { RoleBadge } from '@/components/users/role-badge'
import { Badge, BadgeButton } from '@/components/ui/badge'
import { BalanceCell } from '@/components/ui/balance-cell'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { HintedValue } from '@/components/tables/hinted-value'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import type { WorkerColumnFiguresT } from '@/lib/kosztorys/worker-payout-pairs'
import { cn } from '@/lib/utils/cn'
import { TrashRowButton } from '@/components/trash/trash-row-button'
import { trashWorkerAction } from '@/lib/actions/worker-trash'
import { describeWorkerTrash } from '@/lib/workers/describe-trash'
import { actionsColumn } from '@/components/tables/columns/actions-column'
import { EmptyValue } from '@/components/ui/empty-value'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

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

// Four figures, never netted: a nadpłata on one investment is not a discount on another.
function PayoutRemainingCell({
  view,
  onSettle,
}: {
  view: WorkerColumnFiguresT | undefined
  onSettle: () => void
}) {
  if (!view) return <EmptyValue />
  const lines = PAYOUT_LINES.map((line) => {
    const bucket = view[line.bucket]
    const count = line.kind === 'owed' ? bucket.owedCount : bucket.overpaidCount
    return { ...line, count, amount: bucket[line.kind] }
  }).filter((line) => line.count > 0)
  const withheldCount = view.active.withheldCount + view.completed.withheldCount
  return (
    <span className="inline-flex flex-col items-end">
      {/* The withheld hint stays outside: its tooltip trigger is a button of its own. */}
      <Button variant="link" size="inline" className="flex-col items-end gap-0" onClick={onSettle}>
        {lines.length === 0 ? (
          <BalanceCell value={0} settled />
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
      meta: { minWidth: 'min-w-56' },
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
      cell: (info) => {
        const isActive = info.getValue()
        const tone = isActive ? 'positive' : 'muted'
        const label = isActive ? 'Aktywny' : 'Nieaktywny'
        return info.row.original.canManage ? (
          <BadgeButton tone={tone} onClick={() => onToggle(info.row.original.id, !isActive)}>
            {label}
          </BadgeButton>
        ) : (
          <Badge tone={tone}>{label}</Badge>
        )
      },
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
      cell: (info) => info.getValue() ?? EMPTY_VALUE,
    }),
    col.accessor((row) => row.registerNames.length, {
      id: 'registers',
      header: 'Kasy',
      meta: { align: 'right' },
      cell: (info) =>
        info.getValue() === 0 ? (
          EMPTY_VALUE
        ) : (
          <SimpleTooltip content={info.row.original.registerNames.join(', ')}>
            <span>{info.getValue()}</span>
          </SimpleTooltip>
        ),
    }),
    actionsColumn<UserRowT>(
      (worker) =>
        worker.canManage && (
          <TrashRowButton
            label="Usuń pracownika"
            description={describeWorkerTrash(worker.name, worker.registerNames)}
            trash={() => trashWorkerAction(worker.id)}
            trashed="Pracownik przeniesiony do kosza."
          />
        ),
    ),
  ]
}
