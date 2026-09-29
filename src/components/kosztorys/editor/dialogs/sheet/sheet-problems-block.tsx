'use client'

import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet/sheet-column-picker'
import { requiredFields } from '@/components/kosztorys/editor/dialogs/sheet/sheet-column-picker-options'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/report/sheet-report-block'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'

type PropsT = {
  investmentId: number
  problems: string[]
  columns: UnresolvedColumnsT
  // What the two windows do NOT do when they refuse — „nadpisane" for „Pobierz", „zmienione" for
  // „Porównaj". The only thing that differs between them.
  consequence: string
  onMappingSaved: () => void
}

// A refused read, in both windows. Not every refusal is a column that went missing — a header row
// nobody can find leaves nothing to point at — so the verdict promises a pick only when there is one.
export function SheetProblemsBlock({
  investmentId,
  problems,
  columns,
  consequence,
  onMappingSaved,
}: PropsT) {
  const missing = requiredFields(columns)
  const canPoint = missing.length > 0 && columns.candidates.length > 0

  return (
    <SheetReportBlock
      title="Nie mogę odczytać arkusza Google"
      status="warn"
      verdict={
        canPoint
          ? `Wskaż brakującą kolumnę poniżej albo popraw nagłówki w arkuszu — ${consequence}.`
          : `Popraw nagłówki w arkuszu i spróbuj ponownie — ${consequence}.`
      }
    >
      {problems.map((problem) => (
        <p key={problem} className="text-destructive">
          {problem}
        </p>
      ))}
      <SheetColumnPicker
        investmentId={investmentId}
        missing={missing}
        pointed={columns.pointedFields}
        candidates={columns.candidates}
        onSaved={onMappingSaved}
      />
    </SheetReportBlock>
  )
}
