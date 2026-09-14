'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table/data-table'
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
    cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue() || '—'}</span>,
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Wpisał',
    cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue() || '—'}</span>,
  }),
  col.accessor((row) => row.cost ?? undefined, {
    id: 'cost',
    header: 'Koszt',
    meta: { align: 'right' },
    // A handover has no price at all, so it parks at the end rather than leading a costliest-first
    // sort.
    sortUndefined: 'last',
    cell: (info) => <span className="tabular-nums">{formatPLNOrDash(info.row.original.cost)}</span>,
  }),
]

const COST_COLUMN_ID = 'cost'

/**
 * The log, newest first — the answer to „a kto to miał wcześniej". Read-only by design: an event is
 * a fact that happened, so a mistake is corrected by recording the correction, not by rewriting
 * history.
 */
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
      // What the tool has cost since it was bought — every serwis entry, summed where the reader is
      // already looking at them instead of on a second screen.
      footer={(visibleColumnIds) => {
        const costIndex = visibleColumnIds.indexOf(COST_COLUMN_ID)
        if (costIndex < 0) return null

        return (
          <tr>
            {costIndex > 0 && (
              <td className="font-bold" colSpan={costIndex}>
                Koszty serwisu
              </td>
            )}
            <td className="text-right font-bold tabular-nums">
              {formatPLNOrDash(sumKnown(history.map((event) => event.cost)))}
            </td>
            {visibleColumnIds.slice(costIndex + 1).map((id) => (
              <td key={id} />
            ))}
          </tr>
        )
      }}
    />
  )
}
