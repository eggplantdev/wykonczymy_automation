'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { EditEquipmentDialog } from '@/components/dialogs/edit-equipment-dialog'
import { TransferEquipmentDialog } from '@/components/dialogs/transfer-equipment-dialog'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { LocationCell } from '@/components/equipment/location-cell'
import { WarrantyCell } from '@/components/equipment/warranty-cell'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { makeModel } from '@/lib/utils/make-model'
import { classifyWarranty, warrantyDaysLeft } from '@/lib/equipment/warranty-thresholds'
import type { EquipmentRowT, WarehouseOptionT } from '@/lib/equipment/types'
import type { DayT } from '@/lib/utils/days'
import { TrashRowButton } from '@/components/trash/trash-row-button'
import { trashEquipmentAction } from '@/lib/actions/equipment-trash'
import { describeEquipmentTrash } from '@/lib/equipment/describe-trash'
import { actionsColumn } from '@/components/tables/columns/actions-column'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

const col = createColumnHelper<EquipmentRowT>()

type EquipmentColumnsArgsT = {
  today: DayT
  warehouses: WarehouseOptionT[]
}

/**
 * `today` is a parameter: every row on the page must answer „za ile dni" as of the same instant, and
 * a cell that reads the clock re-renders itself into a different answer than its neighbour after
 * midnight.
 */
export function getEquipmentColumns({ today, warehouses }: EquipmentColumnsArgsT) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor(makeModel, {
      id: 'makeModel',
      header: 'Marka / model',
      cell: (info) => info.getValue() || EMPTY_VALUE,
    }),
    col.accessor('serialNumber', {
      id: 'serialNumber',
      header: 'Nr seryjny',
      cell: (info) => info.getValue() || EMPTY_VALUE,
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
      cell: (info) => info.getValue() || EMPTY_VALUE,
    }),
    col.accessor((row) => warrantyDaysLeft(row.warrantyUntil, today) ?? undefined, {
      id: 'warranty',
      header: 'Gwarancja',
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
    // The row's own click is unaffected — `DataTableRow` ignores a click that landed on a button.
    actionsColumn<EquipmentRowT>((equipment) => (
      <>
        <TransferEquipmentDialog equipment={equipment} warehouses={warehouses} />
        <EditEquipmentDialog equipment={equipment} />
        <TrashRowButton
          label="Usuń sprzęt"
          description={describeEquipmentTrash(equipment)}
          trash={() => trashEquipmentAction(equipment.id)}
          trashed="Sprzęt przeniesiony do kosza."
        />
      </>
    )),
  ]
}
