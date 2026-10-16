'use client'

import { useTranslation } from '@/hooks/use-translation'
import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionFooterContextT = {
  figures: Map<number, Map<string, number>>
  labelColumnId: string | undefined
}

const LABEL_COLUMN_CANDIDATES = [IDENTITY_COLUMN_ID, 'sectionName']

export function sectionFooterLabelColumnId(
  columnIds: readonly (string | undefined)[],
): string | undefined {
  return LABEL_COLUMN_CANDIDATES.find((id) => columnIds.includes(id))
}

export function SectionFooterCell({
  rowData,
  columnId,
  context,
}: {
  rowData: KosztorysV2RowT
  columnId: string | undefined
  context: SectionFooterContextT
}) {
  const { t } = useTranslation('grid')
  if (columnId != null && columnId === context.labelColumnId)
    return (
      <div className="text-foreground grid-cell-text flex size-full items-center gap-1 overflow-hidden px-2 font-bold whitespace-nowrap">
        <span>{t('total')}</span>
        <span>{rowData.sectionName ?? ''}</span>
      </div>
    )

  const value = columnId == null ? undefined : context.figures.get(rowData.sectionId)?.get(columnId)
  if (value == null) return <div className="size-full" />

  return (
    <div className="grid-cell-text flex size-full items-center px-2 font-semibold tabular-nums">
      {formatNet(value)}
    </div>
  )
}
