'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { PresetRowActions } from '@/components/presets/preset-row-actions'
import { dateCell } from '@/components/tables/columns/date-cell'
import type { PresetRowT } from '@/lib/queries/presets'

const col = createColumnHelper<PresetRowT>()

export const PRESET_COLUMNS = [
  col.accessor('name', { header: 'Nazwa' }),
  col.accessor('sectionCount', {
    header: 'Sekcje',
    meta: { align: 'right' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('itemCount', {
    header: 'Pozycje',
    meta: { align: 'right' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('updatedAt', { header: 'Zmieniono', cell: dateCell }),
  col.accessor('createdAt', { header: 'Utworzono', cell: dateCell }),
  col.display({
    id: 'actions',
    header: 'Akcje',
    meta: { align: 'right' },
    cell: (info) => <PresetRowActions preset={info.row.original} />,
  }),
]
