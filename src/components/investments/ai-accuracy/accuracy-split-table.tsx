import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import type { AiAccuracyWindowT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'

const COLS = `${SUMMARY_LABEL_COL} repeat(4, ${SUMMARY_VALUE_COL})`

type PropsT = { rows: { label: string; window: AiAccuracyWindowT }[] }

export function AccuracySplitTable({ rows }: PropsT) {
  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Przypadki</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">AI pominęło</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">AI dodało niepotrzebnie</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Zła ilość</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Razem</SummaryHeaderCell>
      {rows.flatMap(({ label, window }) => [
        <SummaryCell key={`${label}-label`}>{label}</SummaryCell>,
        <SummaryCell key={`${label}-missed`} className="text-right">
          {formatPLN(window.missedZl)}
        </SummaryCell>,
        <SummaryCell key={`${label}-extra`} className="text-right">
          {formatPLN(window.extraZl)}
        </SummaryCell>,
        <SummaryCell key={`${label}-qty`} className="text-right">
          {formatPLN(window.qtyZl)}
        </SummaryCell>,
        <SummaryCell key={`${label}-split`} className="text-right" weight="medium">
          {formatPLN(window.splitZl)}
        </SummaryCell>,
      ])}
    </SummaryTable>
  )
}
