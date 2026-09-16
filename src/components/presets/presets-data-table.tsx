'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { PRESET_COLUMNS } from '@/components/tables/presets'
import { useOpenPreset } from '@/components/presets/use-open-preset'
import type { PresetRowT } from '@/lib/queries/presets'

const INITIAL_SORTING = [{ id: 'createdAt', desc: true }]

export function PresetsDataTable({ data }: { data: PresetRowT[] }) {
  const { open, pendingId } = useOpenPreset()

  return (
    <DataTable
      data={data}
      columns={PRESET_COLUMNS}
      storageKey="presets"
      initialSorting={INITIAL_SORTING}
      onRowClick={(row) => open(row.id)}
      getRowClassName={(row) => (pendingId === row.id ? 'opacity-50' : '')}
    />
  )
}
