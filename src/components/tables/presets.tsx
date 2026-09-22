'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { PresetRowActions } from '@/components/presets/preset-row-actions'
import { formatPLDate } from '@/lib/utils/format-date'
import type { PresetRowT } from '@/lib/queries/presets'

const col = createColumnHelper<PresetRowT>()

export const PRESET_COLUMNS = [
  col.accessor('name', { header: 'Nazwa' }),
  col.accessor('sectionCount', {
    header: 'Sekcje',
    meta: { align: 'right' },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('itemCount', {
    header: 'Pozycje',
    meta: { align: 'right' },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('updatedAt', {
    header: 'Zmieniono',
    // „—" for a szablon predating the autosave: an empty cell would read as a failed lookup.
    cell: (info) => {
      const value = info.getValue()
      return value == null ? '—' : formatPLDate(value)
    },
  }),
  col.accessor('createdAt', {
    header: 'Utworzono',
    cell: (info) => formatPLDate(info.getValue()),
  }),
  col.display({
    id: 'actions',
    header: 'Akcje',
    meta: { align: 'right' },
    cell: (info) => <PresetRowActions preset={info.row.original} />,
  }),
]
