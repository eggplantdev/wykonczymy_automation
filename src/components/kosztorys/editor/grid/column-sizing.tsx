'use client'

import { Column } from 'react-datasheet-grid'
import { ResizableHeader } from '@/components/ui/datasheet-grid/column-resize-handle'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const DEFAULT_COLUMN_MIN_WIDTH = 110

export function withResize(
  col: Column<KosztorysV2RowT>,
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  // A fixed-width column (min === max, e.g. the row-actions column) has nothing to drag — skip the
  // resizable header rather than hang a dead handle on it.
  if (col.minWidth != null && col.minWidth === col.maxWidth) return col
  // A default, not a clamp: a column that declares its own minWidth keeps it (the trailing gap wants
  // 24). dsg clamps an unpinned column's rendered width to its minWidth on overflow (many columns >
  // viewport), so this is the actual initial width, not just a drag limit.
  const min = col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH
  const pinned = opts.widths?.[col.id]
  // Pinning = a rigid width independent of dsg's flex algorithm: min=max=basis=W,
  // grow/shrink 0. (dsg ignored `basis` alone on overflow — it fell back to minWidth.)
  const sized: Column<KosztorysV2RowT> =
    pinned != null
      ? { ...col, basis: pinned, grow: 0, shrink: 0, minWidth: pinned, maxWidth: pinned }
      : { ...col, minWidth: min }
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

// A trailing empty spacer column pinned to the far right of the grid. Resizable (min ≠ max) so its
// width is the user's call; 48 is only the default basis. The Praca/Postęp divider is „Komentarz"
// itself, at the seam — this column is only the end-of-grid gap.
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

// Append the empty spacer to the far right of the visible grid. Inserted here, post-filter, so it
// never appears in the column picker and always shows. Wrapped in withResize (not in the assembly
// map, which runs before this append) so it gets a drag handle.
export function appendTrailingGap(
  columns: Column<KosztorysV2RowT>[],
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT>[] {
  return [...columns, withResize(layerGapColumn, opts)]
}
