'use client'

import { useState, type ReactNode, type RefObject } from 'react'
import type { Column, DataSheetGridRef } from 'react-datasheet-grid'

import {
  HeaderMenuExtensionContext,
  type HeaderMenuExtensionT,
} from '@/components/ui/datasheet-grid/header-menu-extension'
import {
  ColumnWidthAllContext,
  type ColumnWidthAllT,
} from '@/components/kosztorys/editor/actions/column-width-open'
import { ColumnWidthHeaderItems } from '@/components/kosztorys/editor/actions/column-width-header-items'
import { ColumnWidthDialog } from '@/components/kosztorys/editor/dialogs/column-width-dialog'
import { useColumnWidths } from '@/components/kosztorys/editor/hooks/use-column-widths'
import { resizableColumnIds, selectionTargetIds } from '@/lib/kosztorys/column-width-targets'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type PropsT = {
  datasheetRef: RefObject<DataSheetGridRef | null>
  columns: Column<KosztorysV2RowT>[]
  enabled: boolean
  children: ReactNode
}

export function ColumnWidthHost({ datasheetRef, columns, enabled, children }: PropsT) {
  const { widths, setWidths, dropWidth } = useColumnWidths()
  const [dialogIds, setDialogIds] = useState<string[] | undefined>(undefined)

  if (!enabled) return children

  const extension: HeaderMenuExtensionT = {
    targetIds: (columnId) =>
      selectionTargetIds(columns, widths, datasheetRef.current?.selection, columnId),
    items: (ids) => (
      <ColumnWidthHeaderItems
        count={ids.length}
        onOpenDialog={() => setDialogIds(ids)}
        onReset={() => dropWidth(...ids)}
      />
    ),
  }
  const all: ColumnWidthAllT = {
    openAll: () => setDialogIds(resizableColumnIds(columns, widths)),
    resetAll: () => dropWidth(...columns.flatMap((column) => (column.id ? [column.id] : []))),
  }

  return (
    <ColumnWidthAllContext value={all}>
      <HeaderMenuExtensionContext value={extension}>{children}</HeaderMenuExtensionContext>
      {dialogIds && (
        <ColumnWidthDialog
          ids={dialogIds}
          widths={widths}
          onApply={(width) => setWidths(dialogIds, width)}
          onClose={() => setDialogIds(undefined)}
        />
      )}
    </ColumnWidthAllContext>
  )
}
