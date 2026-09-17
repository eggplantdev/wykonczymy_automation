'use client'

import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet-column-picker'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'

/**
 * The pointings that made a CLEAN read clean. Beside a shortfall only, „Usuń wskazanie" would vanish
 * with the last missing column, leaving a saved pointing nothing can take back. Styled neutral: a
 * pointed column is not a defect.
 */
export function SheetPointedColumnsBlock({
  investmentId,
  columns,
  onMappingSaved,
}: {
  investmentId: number
  columns: UnresolvedColumnsT
  onMappingSaved: () => void
}) {
  if (columns.pointedFields.length === 0) return null
  return (
    <SheetReportBlock
      title="Kolumny wskazane ręcznie"
      status="ok"
      verdict="Odczyt zadziałał dzięki wskazaniu. Zdejmij je, gdy poprawisz nagłówek w samym arkuszu — poprawiony nagłówek i tak wygrywa."
    >
      <SheetColumnPicker
        investmentId={investmentId}
        missing={[]}
        pointed={columns.pointedFields}
        candidates={columns.candidates}
        onSaved={onMappingSaved}
      />
    </SheetReportBlock>
  )
}
