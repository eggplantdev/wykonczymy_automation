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
import { pluralize } from '@/lib/utils/polish-plural'

const col = createColumnHelper<UserRowT>()

const investmentsCount = (count: number) =>
  `${count} ${pluralize(count, ['inwestycji', 'inwestycjach', 'inwestycjach'])}`

// A nadpłata on one investment is never subtracted from a debt on another, and a withheld pair has no
// figure to add — both are counted beside the sum instead of hidden in it.
function PayoutRemainingCell({
  figures,
  onSettle,
}: {
  figures: WorkerColumnFiguresT | undefined
  onSettle: () => void
}) {
  if (!figures) return <span className="text-muted-foreground">—</span>
  const { owed, overpaidCount, withheldCount } = figures
  return (
    <span className="inline-flex flex-col items-end">
      <Button variant="link" className="h-auto p-0" onClick={onSettle}>
        {formatPLN(owed)}
      </Button>
      {overpaidCount > 0 && (
        <span className="text-destructive text-xs">
          nadpłata na {investmentsCount(overpaidCount)}
        </span>
      )}
      {withheldCount > 0 && (
        <HintedValue
          hint={
            <LabelHintIcon
              variant="planeUnconfirmed"
              content="Na tych inwestycjach ten pracownik ma etap z wykonaną pracą bez ustawionego rozliczenia, więc jego należne nie jest znane — nie wchodzi do kwoty obok."
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
    col.accessor((row) => row.payoutRemaining?.owed, {
      id: 'payoutRemaining',
      sortUndefined: 'last',
      header: SUBCONTRACTOR_FIGURE_LABELS.remaining,
      meta: { align: 'right' },
      cell: (info) => (
        <PayoutRemainingCell
          figures={info.row.original.payoutRemaining}
          onSettle={() => onSettle(info.row.original)}
        />
      ),
    }),
    col.accessor('defaultCashRegisterName', {
      id: 'defaultCashRegister',
      header: 'Domyślna kasa',
      cell: (info) => info.getValue() ?? '—',
    }),
  ]
}
