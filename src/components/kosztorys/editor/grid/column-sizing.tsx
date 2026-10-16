'use client'

import { Column } from 'react-datasheet-grid'
import { ResizableHeader } from '@/components/ui/datasheet-grid/column-resize-handle'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const DEFAULT_COLUMN_MIN_WIDTH = 130

// dsg ignored `basis` alone on overflow — it fell back to minWidth.
export const pinnedWidth = (width: number) =>
  ({ basis: width, grow: 0, shrink: 0, minWidth: width, maxWidth: width }) as const

export function withResize(
  col: Column<KosztorysV2RowT>,
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  if (col.minWidth != null && col.minWidth === col.maxWidth) return col
  // dsg clamps an unpinned column's rendered width to its minWidth on overflow (many columns >
  // viewport), so this is the actual initial width, not just a drag limit.
  const min = col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH
  const pinned = opts.widths?.[col.id]
  const sized: Column<KosztorysV2RowT> =
    pinned != null ? { ...col, ...pinnedWidth(pinned) } : { ...col, minWidth: min }
  return {
    ...sized,
    title: (
      <ResizableHeader
        colId={col.id}
        minWidth={min}
        onGuide={opts.onGuide}
        onCommit={opts.onCommitColumn}
      >
        {col.title}
      </ResizableHeader>
    ),
  }
}

const layerGapColumn: Column<KosztorysV2RowT> = {
  id: 'layerGap',
  title: <span />,
  basis: 48,
  grow: 0,
  shrink: 0,
  minWidth: 24,
  maxWidth: 400,
  disabled: true,
  headerClassName: 'border-l border-border',
  cellClassName: 'border-l border-border',
  component: () => null,
}

export function appendTrailingGap(
  columns: Column<KosztorysV2RowT>[],
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT>[] {
  return [...columns, withResize(layerGapColumn, opts)]
}
