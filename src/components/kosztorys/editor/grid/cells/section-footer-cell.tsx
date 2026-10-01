'use client'

import { useTranslation } from '@/hooks/use-translation'
import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Carried on the wrapped column's `columnData`, never a closure — see kosztorys-synthetic-rows.tsx.
// A map rather than named fields is what keeps the footer open-ended: a column with no entry renders
// blank, so covering one later is an entry, not a branch here.
export type SectionFooterContextT = {
  figures: Map<number, Map<string, number>>
  labelColumnId: string | undefined
}

// The label sits under „Opis prac", where the eye already reads what each row is, and that column is
// wide enough (min 360px) to hold it without spilling into its neighbour. It can be hidden by the
// picker, hence a candidate list rather than a fixed id — „Sekcja" then takes over.
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
    // No spill out of the cell (unlike the opening band's label): „Opis prac" is wide enough to hold
    // the name, and the footer's own vertical rules are what line its figures up with the columns
    // above — letting the label cross one would break that alignment for a name it rarely needs.
    return (
      <div className="text-foreground flex size-full items-center gap-1 overflow-hidden px-2 text-sm font-bold whitespace-nowrap">
        <span>{t('total')}</span>
        <span>{rowData.sectionName ?? ''}</span>
      </div>
    )

  const value = columnId == null ? undefined : context.figures.get(rowData.sectionId)?.get(columnId)
  if (value == null) return <div className="size-full" />

  // Left-aligned like the data cells and like „Razem", so a section's figure sits directly under the
  // column's values and directly above the grand total.
  return (
    <div className="flex size-full items-center px-2 text-sm font-semibold tabular-nums">
      {formatNet(value)}
    </div>
  )
}
