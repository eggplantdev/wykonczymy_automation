'use client'

import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet-column-picker'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { columnNoun } from '@/lib/kosztorys/counted-nouns'
import { FIELD_LABELS } from '@/lib/kosztorys/sheet-import/columns'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'

/**
 * Optional columns the header did not name. A missing required one refuses the read and lands in
 * „Problemy"; an optional one lets it succeed, so without this the window reports a clean comparison
 * having skipped a whole column.
 */
export function SheetMissingColumnsBlock({
  investmentId,
  columns,
  onMappingSaved,
}: {
  investmentId: number
  columns: UnresolvedColumnsT
  onMappingSaved: () => void
}) {
  const missing = columns.missingFields.filter((column) => !column.required)
  if (missing.length === 0) return null
  const names = missing.map((column) => `„${FIELD_LABELS[column.field]}"`).join(', ')

  return (
    <SheetReportBlock
      title="Kolumny, których nie odczytaliśmy"
      status="warn"
      verdict={`Nagłówek arkusza nie nazywa ${missing.length} ${columnNoun(missing.length)}: ${names}. Porównanie je pomija, a zapisane wartości zostają nietknięte. Wskaż kolumnę poniżej albo popraw nagłówek w samym arkuszu.`}
    >
      <SheetColumnPicker
        investmentId={investmentId}
        missing={missing.map((column) => column.field)}
        pointed={[]}
        candidates={columns.candidates}
        onSaved={onMappingSaved}
      />
    </SheetReportBlock>
  )
}
