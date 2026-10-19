'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { BalanceCell } from '@/components/ui/balance-cell'
import { Badge, BadgeButton } from '@/components/ui/badge'
import { TrashRowButton } from '@/components/trash/trash-row-button'
import { trashCashRegisterAction } from '@/lib/actions/cash-register-trash'
import { REGISTER_TYPE_LABELS } from '@/lib/cash-registers/register-types'
import type { CashRegisterRowT } from '@/types/table-rows'

const col = createColumnHelper<CashRegisterRowT>()

export function getCashRegisterColumns(
  onToggle: (id: number, newActive: boolean) => void,
  canManage: (row: CashRegisterRowT) => boolean,
) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
    }),
    col.accessor('type', {
      id: 'type',
      header: 'Typ',
      cell: (info) => REGISTER_TYPE_LABELS[info.getValue()],
    }),
    col.accessor('ownerName', {
      id: 'ownerName',
      header: 'Właściciel',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('balance', {
      id: 'balance',
      header: 'Saldo',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => {
        const isActive = info.getValue()
        const tone = isActive ? 'positive' : 'muted'
        const label = isActive ? 'Aktywna' : 'Nieaktywna'
        return canManage(info.row.original) ? (
          <BadgeButton tone={tone} onClick={() => onToggle(info.row.original.id, !isActive)}>
            {label}
          </BadgeButton>
        ) : (
          <Badge tone={tone}>{label}</Badge>
        )
      },
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) =>
        canManage(info.row.original) && (
          <div className="flex items-center justify-end gap-1">
            <TrashRowButton
              label="Usuń kasę"
              description={`Przenieść „${info.row.original.name}" do kosza? Możesz ją przywrócić z Kosza.`}
              trash={() => trashCashRegisterAction(info.row.original.id)}
              trashed="Kasa przeniesiona do kosza."
            />
          </div>
        ),
    }),
  ]
}
