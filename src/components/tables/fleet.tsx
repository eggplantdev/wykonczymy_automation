'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { DeadlineCell } from '@/components/fleet/deadline-cell'
import { OilIntervalBadge } from '@/components/fleet/oil-interval-badge'
import { FlagBadge } from '@/components/fleet/flag-badge'
import { INSPECTION_TYPE_LABELS, SCHEDULED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { makeModel } from '@/lib/utils/make-model'
import { TrashRowButton } from '@/components/trash/trash-row-button'
import { trashVehicleAction } from '@/lib/actions/vehicle-trash'
import { describeVehicleTrash } from '@/lib/fleet/describe-trash'
import type { FleetRowT } from '@/types/fleet'

const col = createColumnHelper<FleetRowT>()

export const COSTS_COLUMN_ID = 'costs'

export function getFleetColumns() {
  return [
    col.accessor('registration', {
      id: 'registration',
      header: 'Rejestracja',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor((row) => makeModel(row), {
      id: 'vehicle',
      header: 'Pojazd',
      cell: (info) => (
        <span>
          {info.getValue()}
          {info.row.original.year ? ` (${info.row.original.year})` : ''}
        </span>
      ),
    }),
    // „Opony" is the set currently on the car — not the TYRES deadline column below, which is
    // „Wymiana opon" and answers when the next swap is due.
    col.accessor('tyres', {
      id: 'tyres',
      header: 'Opony',
      cell: (info) => <span>{info.getValue() || '—'}</span>,
    }),
    col.accessor((row) => row.activeFlags.length, {
      id: 'flags',
      header: 'Do wymiany',
      // An unflagged car renders nothing, not a dash: the column is an alarm surface, and a column
      // of dashes is what makes an alarm easy to miss.
      cell: (info) => (
        <span className="flex flex-wrap gap-1">
          {info.row.original.activeFlags.map((type) => (
            <FlagBadge key={type} type={type} />
          ))}
        </span>
      ),
    }),
    col.accessor((row) => row.totalCosts ?? undefined, {
      id: COSTS_COLUMN_ID,
      header: 'Koszty',
      meta: { align: 'right' },
      // Same treatment as an unrecorded deadline: a car whose przeglądy carry no price has no
      // amount to rank, so it parks at the end instead of leading the cheapest-first sort.
      sortUndefined: 'last',
      cell: (info) => (
        <span className="tabular-nums">{formatPLNOrDash(info.row.original.totalCosts)}</span>
      ),
    }),
    ...SCHEDULED_INSPECTION_TYPES.map((type) =>
      col.accessor(
        (row) => {
          const deadline = row.deadlines[type]

          // „bezterminowo" outranks whatever event is still on file: a car marked not-applicable
          // keeps its last przegląd row, so sorting on `daysLeft` alone would rank it among the live
          // deadlines while the cell reads that nothing is due.
          return deadline.exempt ? undefined : (deadline.daysLeft ?? undefined)
        },
        {
          id: type,
          header: INSPECTION_TYPE_LABELS[type].pl,
          // A car with nothing recorded has no distance to sort by; park those at the end rather than
          // letting null read as "most urgent".
          sortUndefined: 'last',
          cell: (info) => (
            <div className="flex flex-col items-start gap-1">
              <DeadlineCell
                deadline={info.row.original.deadlines[type]}
                muted={info.row.original.status === 'RETIRED'}
              />
              {/* The kilometre overrun belongs to the oil deadline, not to the car as a whole. */}
              {type === 'OIL_CHANGE' && (
                <OilIntervalBadge kmSinceOilChange={info.row.original.kmSinceOilChange} />
              )}
            </div>
          ),
        },
      ),
    ),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      cell: (info) => <VehicleStatusBadge status={info.getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          <TrashRowButton
            label="Usuń pojazd"
            description={describeVehicleTrash(info.row.original)}
            trash={() => trashVehicleAction(info.row.original.id)}
            trashed="Pojazd przeniesiony do kosza."
          />
        </div>
      ),
    }),
  ]
}
