'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { PRESET_COLUMNS } from '@/components/tables/presets'
import type { PresetRowT } from '@/lib/queries/presets'

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
