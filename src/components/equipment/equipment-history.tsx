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

const col = createColumnHelper<EquipmentEventRowT>()

const COLUMNS = [
  col.accessor('occurredAt', {
    id: 'occurredAt',
    header: 'Data',
    cell: (info) => <span className="tabular-nums">{formatPLDate(info.getValue())}</span>,
  }),
  col.accessor((row) => targetLabel(row.target), {
    id: 'target',
    header: 'Gdzie trafił',
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    cell: (info) => <span>{info.getValue() || '—'}</span>,
  }),
  col.accessor('note', {
    id: 'note',
    header: 'Notatka',
    enableSorting: false,
    cell: (info) => <span className="text-muted-foreground">{info.getValue() || '—'}</span>,
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Wpisał',
    cell: (info) => <span className="text-muted-foreground">{info.getValue() || '—'}</span>,
  }),
  col.accessor((row) => row.cost ?? undefined, {
    id: 'cost',
    header: 'Koszt',
    meta: { align: 'right' },
    sortUndefined: 'last',
    cell: (info) => <span className="tabular-nums">{formatPLNOrDash(info.row.original.cost)}</span>,
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
