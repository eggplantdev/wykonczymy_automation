'use client'

import { createContext, use } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/tables/data-table/data-table'
import { WORK_CATALOGUE_PICKER_COLUMNS } from '@/components/tables/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type PropsT = {
  items: WorkCatalogueItemT[]
  selectedIds: ReadonlySet<number>
  onToggle: (id: number) => void
}

const col = createColumnHelper<WorkCatalogueItemT>()

// Kategoria first so prace of one trade arrive together, then the opis inside it — the browsing
// order, where /katalog-prac defaults to the opis because it is used to find one known row.
const INITIAL_SORTING = [
  { id: 'category', desc: false },
  { id: 'description', desc: false },
]

// Rows are measured once drawn; this is only the guess for the ones not yet drawn. It is the
// cennik's measured average (a one-line row 37 px, a two-line one 57), so the scrollbar barely moves
// while scrolling.
const ROW_ESTIMATE = 52

const SelectedIdsContext = createContext<ReadonlySet<number>>(new Set())

// `flexRender` mounts a `cell` function as a component, so columns rebuilt per tick would remount every cell in the list.
function SelectCell({
  item,
  onToggle,
}: {
  item: WorkCatalogueItemT
  onToggle: (id: number) => void
}) {
  const selected = use(SelectedIdsContext)
  return (
    <Checkbox
      checked={selected.has(item.id)}
      onCheckedChange={() => onToggle(item.id)}
      aria-label={item.description}
    />
  )
}

export function CataloguePickerTable({ items, selectedIds, onToggle }: PropsT) {
  const columns = [
    col.display({
      id: 'select',
      header: '',
      size: 40,
      cell: (info) => <SelectCell item={info.row.original} onToggle={onToggle} />,
    }),
    ...WORK_CATALOGUE_PICKER_COLUMNS,
  ]
  return (
    <SelectedIdsContext value={selectedIds}>
      <DataTable
        data={items}
        columns={columns}
        initialSorting={INITIAL_SORTING}
        enableVirtualization
        virtualRowHeight={ROW_ESTIMATE}
        virtualContainerClassName="max-h-dialog-scroll"
      />
    </SelectedIdsContext>
  )
}
