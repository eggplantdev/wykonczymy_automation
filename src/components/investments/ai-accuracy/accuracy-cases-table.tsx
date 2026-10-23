import Link from 'next/link'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { TextLink } from '@/components/ui/text-link'
import type { AiAccuracyCaseScoreT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatWholePercent } from './format'

const COLS = `${SUMMARY_NAME_COL} repeat(4, ${SUMMARY_VALUE_COL})`

export function AccuracyCasesTable({ cases }: { cases: AiAccuracyCaseScoreT[] }) {
  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Inwestycja</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Kosztorys właściciela</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Błędy AI</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">AI miało dobrze</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Błąd bez Powodu zmiany</SummaryHeaderCell>
      {cases.flatMap((score) => [
        <SummaryCell key={`${score.investmentId}-name`}>
          <TextLink asChild>
            <Link href={`/inwestycje/${score.investmentId}`}>{score.label}</Link>
          </TextLink>
        </SummaryCell>,
        <SummaryCell key={`${score.investmentId}-owner`} className="text-right">
          {formatPLN(score.ownerZl)}
        </SummaryCell>,
        <SummaryCell key={`${score.investmentId}-wrong`} className="text-right">
          {formatPLN(score.wrongZl)}
        </SummaryCell>,
        <SummaryCell key={`${score.investmentId}-right`} className="text-right">
          {formatWholePercent(score.rightPercent)}
        </SummaryCell>,
        <SummaryCell key={`${score.investmentId}-reason`} className="text-right">
          {formatWholePercent(score.noReasonPercent)}
        </SummaryCell>,
      ])}
    </SummaryTable>
  )
}
