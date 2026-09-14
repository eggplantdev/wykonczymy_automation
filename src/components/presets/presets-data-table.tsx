'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { PRESET_COLUMNS, type PresetRowT } from '@/components/tables/presets'

const INITIAL_SORTING = [{ id: 'createdAt', desc: true }]

export function PresetsDataTable({ data }: { data: PresetRowT[] }) {
  return (
    <DataTable
      data={data}
      columns={PRESET_COLUMNS}
      storageKey="presets"
      initialSorting={INITIAL_SORTING}
    />
  )
}
