import { Column } from 'react-datasheet-grid'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { withCellClass } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { sectionColorColumnTint, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { stageIdOfKey } from '@/lib/kosztorys/stage-keys'
import { cn } from '@/lib/utils/cn'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const COLUMN_TINT_CLASS = 'kosztorys-column-tint'

const COMPLETED_STAGE_COLOR: SectionColorKeyT = 'green'

type ColumnColorOptsT = Pick<BuildV2ColumnsOptsT, 'columnColors' | 'stages'>

// One key per column, never two tint classes: both would set `--column-tint`, and which one wins
// would then follow Tailwind's stylesheet order, not this precedence.
function columnColorKey(id: string, opts: ColumnColorOptsT): SectionColorKeyT | undefined {
  const stageId = stageIdOfKey(id)
  if (stageId !== null && opts.stages.some((stage) => stage.id === stageId && stage.completed)) {
    return COMPLETED_STAGE_COLOR
  }
  return opts.columnColors?.[id]
}

export function withColumnColor(
  col: Column<KosztorysV2RowT>,
  opts: ColumnColorOptsT,
): Column<KosztorysV2RowT> {
  const tint = col.id ? sectionColorColumnTint(columnColorKey(col.id, opts)) : undefined
  if (!tint) return col
  const className = cn(COLUMN_TINT_CLASS, tint)
  return {
    ...col,
    cellClassName: withCellClass(col.cellClassName, className),
    headerClassName: cn(col.headerClassName, className),
  }
}
