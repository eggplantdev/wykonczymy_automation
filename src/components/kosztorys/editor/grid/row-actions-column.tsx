'use client'

import { Column, type CellProps } from 'react-datasheet-grid'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu'
import { useCataloguePicker } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// `opts` rides `columnData` so this component keeps ONE identity across renders — dsg answers a
// changed `component` type with a remount (EX-422, lessons.md), which here tore down the menu's own
// state and closed an open usuń/katalog dialog on any unrelated editor change.
type RowActionsCellDataT = { opts: BuildV2ColumnsOptsT }

function RowActionsCell({ rowData, columnData }: CellProps<KosztorysV2RowT, RowActionsCellDataT>) {
  const { opts } = columnData
  // All four section callbacks come from one `editorOnly()` gate, so this reads as a single
  // "editor mode?" test rather than four independent ones.
  const { onInsertSection, onReorderSection, onSetSectionColor, onRemoveSection } = opts
  // Read from context rather than threaded through opts: the picker's open state must not sit
  // anywhere the grid re-renders from (EX-496), and this opener never changes identity.
  const openCataloguePicker = useCataloguePicker()
  const section =
    onInsertSection && onReorderSection && onSetSectionColor && onRemoveSection
      ? {
          color: rowData.sectionColor,
          name: rowData.sectionName ?? undefined,
          itemCount: opts.getSectionItemCount?.(rowData.sectionId) ?? 0,
          onInsertAbove: () => onInsertSection(rowData.sectionId, 'above'),
          onInsertBelow: () => onInsertSection(rowData.sectionId, 'below'),
          onMoveUp: () => onReorderSection(rowData.sectionId, 'up'),
          onMoveDown: () => onReorderSection(rowData.sectionId, 'down'),
          onSetColor: (color: SectionColorKeyT | null) =>
            onSetSectionColor(rowData.sectionId, color),
          onRemove: () => onRemoveSection(rowData.sectionId),
        }
      : undefined

  return (
    <KosztorysRowActionsMenu
      sortActive={opts.sort != null}
      item={{
        onInsertAbove: () => opts.onInsertItem?.(rowData, 'above'),
        onInsertBelow: () => opts.onInsertItem?.(rowData, 'below'),
        onMoveUp: () => opts.onReorderItem?.(rowData, 'up'),
        onMoveDown: () => opts.onReorderItem?.(rowData, 'down'),
        onRemove: () => opts.onRemoveItem?.(rowData),
        savableItemId: opts.canSaveItemToCatalogue ? rowData.id : undefined,
        // Lands in this row's SECTION, which is why it rides the section gate rather than its own.
        onAddFromCatalogue: section ? () => openCataloguePicker(rowData.sectionId) : undefined,
      }}
      section={section}
    />
  )
}

export function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  return {
    id: 'actions',
    title: <HeaderLabel className="px-1">Akcje</HeaderLabel>,
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    // Not `disabled`: dsg treats that flag as "never focusable", which blocked the row-actions
    // button from Tab/Enter entirely. `kosztorys-actions-cell` only strips dsg's own cell chrome.
    cellClassName: 'kosztorys-actions-cell',
    columnData: { opts },
    component: RowActionsCell,
  }
}
