'use client'

import { type Table, type VisibilityState } from '@tanstack/react-table'
import { ColumnToggleMenu, type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import {
  isTableTextSize,
  type TableTextSizeT,
} from '@/components/tables/data-table/table-text-size'
import { type ColumnRanksT } from '@/lib/table/column-order'
import { columnLabel } from '@/lib/table/column-label'
import { useTranslation } from '@/hooks/use-translation'

type ColumnTogglePropsT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
  textSize: TableTextSizeT
  setTextSize: (size: TableTextSizeT) => void
}

const TEXT_SIZE_OPTIONS = [
  { size: '2xs', labelKey: 'textSizeExtraSmall' },
  { size: 'xs', labelKey: 'textSizeSmall' },
  { size: 'sm', labelKey: 'textSizeMedium' },
  { size: 'base', labelKey: 'textSizeLarge' },
] as const satisfies { size: TableTextSizeT; labelKey: string }[]

export function ColumnToggle<TData>({
  table,
  columnVisibility,
  ranks,
  baseRanks,
  setRank,
  resetOrder,
  textSize,
  setTextSize,
}: ColumnTogglePropsT<TData>) {
  // getAllLeafColumns applies the table's columnOrder; getAllColumns would hand both surfaces the
  // declaration order, so the dialog would open showing the state before the last drag. The base
  // ranks are the other half of that pair and must come from the declared order — hence the prop.
  const { t } = useTranslation('filters')
  const columns = table.getAllLeafColumns().filter((col) => col.getCanHide())
  const items: ColumnToggleItemT[] = columns.map((col) => ({
    id: col.id,
    label: columnLabel(col),
    visible: columnVisibility[col.id] !== false,
  }))

  return (
    <ColumnToggleMenu
      items={items}
      onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
      // Merged into current state, not TanStack's toggleAllColumnsVisible — that rebuilds the map
      // from {} and drops unknown ids, wiping a sibling page's preference (shared storageKey, different excludeColumns).
      onToggleAll={(visible) =>
        table.setColumnVisibility({
          ...columnVisibility,
          ...Object.fromEntries(columns.map((col) => [col.id, visible])),
        })
      }
      order={{
        description: t('orderColumnsDescription'),
        ranks,
        baseRanks,
        onSetRank: setRank,
        onReset: resetOrder,
      }}
      footer={
        <>
          <DropdownMenuLabel>{t('textSize')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={textSize}
            onValueChange={(value) => {
              if (isTableTextSize(value)) setTextSize(value)
            }}
          >
            {TEXT_SIZE_OPTIONS.map(({ size, labelKey }) => (
              <DropdownMenuRadioItem
                key={size}
                value={size}
                // Open, so the table behind shows the size before the menu goes.
                onSelect={(event) => event.preventDefault()}
              >
                {t(labelKey)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </>
      }
    />
  )
}
