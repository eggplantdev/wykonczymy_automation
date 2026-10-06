import { Column } from 'react-datasheet-grid'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { withCellClass } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { sectionColorColumnTint } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// globals.css paints `--column-tint` as a background-image over whatever the cell already is.
const COLUMN_TINT_CLASS = 'kosztorys-column-tint'

export function withColumnColor(
  col: Column<KosztorysV2RowT>,
  opts: Pick<BuildV2ColumnsOptsT, 'columnColors'>,
): Column<KosztorysV2RowT> {
  const tint = col.id ? sectionColorColumnTint(opts.columnColors?.[col.id]) : undefined
  if (!tint) return col
  const className = cn(COLUMN_TINT_CLASS, tint)
  return {
    ...col,
    cellClassName: withCellClass(col.cellClassName, className),
    headerClassName: cn(col.headerClassName, className),
  }
}
