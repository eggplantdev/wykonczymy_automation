'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { PRESET_COLUMNS } from '@/components/tables/presets'
import { CreateEmptyPresetDialog } from '@/components/presets/create-empty-preset-dialog'
import { presetOpenHref } from '@/components/presets/preset-open-href'
import type { PresetRowT } from '@/lib/queries/presets'

export function PresetsDataTable({ data }: { data: PresetRowT[] }) {
  return (
    <DataTable
      data={data}
      columns={PRESET_COLUMNS}
      storageKey="presets"
      // No initial sort: `listPresets` already orders by last edit, NULLS LAST — a client-side sort
      // on „Utworzono" silently replaced it, so the library showed a szablon worked on this morning
      // below one created last month and never touched.
      toolbar={() => <DataTableToolbar actions={<CreateEmptyPresetDialog />} />}
      getRowHref={(row) => presetOpenHref(row.id)}
    />
  )
}
