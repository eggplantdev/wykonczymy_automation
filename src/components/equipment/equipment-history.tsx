'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { ColumnTotalRow } from '@/components/tables/data-table/column-total-row'
import { Description } from '@/components/ui/description'
import { sumKnown } from '@/lib/utils/sum-known'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { targetLabel } from '@/lib/equipment/rows'
import type { EquipmentEventRowT } from '@/lib/equipment/types'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

const col = createColumnHelper<EquipmentEventRowT>()

const COLUMNS = [
  col.accessor('occurredAt', {
    id: 'occurredAt',
    header: 'Data',
    cell: (info) => formatPLDate(info.getValue()),
  }),
  col.accessor((row) => targetLabel(row.target), {
    id: 'target',
    header: 'Gdzie trafił',
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    cell: (info) => info.getValue() || EMPTY_VALUE,
  }),
  col.accessor('note', {
    id: 'note',
    header: 'Notatka',
    enableSorting: false,
    cell: (info) => info.getValue() || EMPTY_VALUE,
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Wpisał',
    cell: (info) => info.getValue() || EMPTY_VALUE,
  }),
  col.accessor((row) => row.cost ?? undefined, {
    id: 'cost',
    header: 'Koszt',
    sortUndefined: 'last',
    cell: (info) => formatPLNOrDash(info.row.original.cost),
  }),
]

const COST_COLUMN_ID = 'cost'

export function EquipmentHistory({ history }: { history: EquipmentEventRowT[] }) {
  if (history.length === 0) {
    return <Description>Brak wpisów — sprzęt nie był jeszcze nikomu przekazany.</Description>
  }

  return (
    <DataTable
      data={history}
      columns={COLUMNS}
      storageKey="equipment-history"
      initialSorting={[{ id: 'occurredAt', desc: true }]}
      footer={(visibleColumnIds) => (
        <ColumnTotalRow
          visibleColumnIds={visibleColumnIds}
          columnId={COST_COLUMN_ID}
          label="Koszty serwisu"
        >
          {formatPLNOrDash(sumKnown(history.map((event) => event.cost)))}
        </ColumnTotalRow>
      )}
    />
  )
}
