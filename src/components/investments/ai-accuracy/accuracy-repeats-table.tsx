import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'

const COLS = `${SUMMARY_NAME_COL} repeat(3, ${SUMMARY_VALUE_COL})`

export function AccuracyRepeatsTable({ repeats }: { repeats: AiAccuracyT['repeats'] }) {
  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Pozycja</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Błąd w ilu przypadkach</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Ile razy wpisano powód</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Błąd razem</SummaryHeaderCell>
      {repeats.flatMap((repeat) => [
        <SummaryCell key={`${repeat.pozycja}-name`}>{repeat.pozycja}</SummaryCell>,
        <SummaryCell key={`${repeat.pozycja}-cases`} className="text-right">
          {repeat.wrongInCases}
        </SummaryCell>,
        <SummaryCell key={`${repeat.pozycja}-reasons`} className="text-right">
          {repeat.reasonsWritten} z {repeat.wrongInCases}
        </SummaryCell>,
        <SummaryCell key={`${repeat.pozycja}-zl`} className="text-right">
          {formatPLN(repeat.wrongZl)}
        </SummaryCell>,
      ])}
    </SummaryTable>
  )
}
