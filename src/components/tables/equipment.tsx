'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { EditEquipmentDialog } from '@/components/dialogs/edit-equipment-dialog'
import { TransferEquipmentDialog } from '@/components/dialogs/transfer-equipment-dialog'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { LocationCell } from '@/components/equipment/location-cell'
import { WarrantyCell } from '@/components/equipment/warranty-cell'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { makeModel } from '@/lib/equipment/rows'
import { classifyWarranty, warrantyDaysLeft } from '@/lib/equipment/warranty-thresholds'
import type { EquipmentRowT, WarehouseOptionT } from '@/lib/equipment/types'
import type { DayT } from '@/lib/utils/days'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

const col = createColumnHelper<EquipmentRowT>()

type EquipmentColumnsArgsT = {
  today: DayT
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
}

/**
 * `today` is a parameter rather than a `new Date()` inside a cell: every row on the page must answer
 * „za ile dni" as of the same instant, and a cell that reads the clock re-renders itself into a
 * different answer than its neighbour after midnight.
 */
export function getEquipmentColumns({
  today,
  workers,
  warehouses,
  investments,
}: EquipmentColumnsArgsT) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor(makeModel, {
      id: 'makeModel',
      header: 'Marka / model',
      cell: (info) => <span>{info.getValue() || '—'}</span>,
    }),
    col.accessor('serialNumber', {
      id: 'serialNumber',
      header: 'Nr seryjny',
      cell: (info) => (
        <span className="text-muted-foreground text-sm">{info.getValue() || '—'}</span>
      ),
    }),
    col.accessor((row) => (row.location.kind === 'holder' ? row.location.name : ''), {
      id: 'holder',
      header: 'Kto ma',
      cell: (info) => (
        <LocationCell
          location={info.row.original.location}
          locatedAt={info.row.original.locatedAt}
          live={isLiveStatus(info.row.original.status)}
          axis="person"
        />
      ),
    }),
    col.accessor(
      (row) =>
        row.location.kind === 'holder' || row.location.kind === 'unknown' ? '' : row.location.name,
      {
        id: 'place',
        header: 'Miejsce',
        cell: (info) => (
          <LocationCell
            location={info.row.original.location}
            locatedAt={info.row.original.locatedAt}
            live={isLiveStatus(info.row.original.status)}
            axis="place"
          />
        ),
      },
    ),
    col.accessor('investmentName', {
      id: 'investment',
      header: 'Inwestycja',
      cell: (info) => <span className="text-sm">{info.getValue() || '—'}</span>,
    }),
    col.accessor((row) => warrantyDaysLeft(row.warrantyUntil, today) ?? undefined, {
      id: 'warranty',
      header: 'Gwarancja',
      // An item with no recorded warranty has nothing to rank, so it parks at the end instead of
      // leading a soonest-first sort.
      sortUndefined: 'last',
      cell: (info) => (
        <WarrantyCell
          warrantyUntil={info.row.original.warrantyUntil}
          daysLeft={warrantyDaysLeft(info.row.original.warrantyUntil, today)}
          bucket={classifyWarranty(info.row.original.warrantyUntil, today)}
          muted={!isLiveStatus(info.row.original.status)}
        />
      ),
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      cell: (info) => <EquipmentStatusBadge status={info.getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      // Handing a tool over is the register's most frequent write, so it does not deserve a detour
      // through the item's page. The row's own click is unaffected — `DataTableRow` ignores a click
      // that landed on a button.
      cell: (info) => (
        <div className="flex items-center gap-1">
          <TransferEquipmentDialog
            equipment={info.row.original}
            workers={workers}
            warehouses={warehouses}
            investments={investments}
          />
          <EditEquipmentDialog equipment={info.row.original} />
        </div>
      ),
    }),
  ]
}
