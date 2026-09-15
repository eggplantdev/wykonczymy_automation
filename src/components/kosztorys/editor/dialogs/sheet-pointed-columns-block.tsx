'use client'

import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet-column-picker'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'

/**
 * The pointings that made a CLEAN read clean. Without this the note lives only beside a shortfall,
 * so the moment a pick resolves the last missing column the block carrying it disappears — and with
 * it „Usuń wskazanie", leaving a pointing saved on the sheet that nothing in either window can take
 * back. Neutral-to-ok on purpose: a pointed column is not a defect, it is the reason the read worked.
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
