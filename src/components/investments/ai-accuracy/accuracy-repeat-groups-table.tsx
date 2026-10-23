import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatWholePercent } from './format'

const COLS = `${SUMMARY_LABEL_COL} repeat(3, ${SUMMARY_VALUE_COL})`

export function AccuracyRepeatGroupsTable({ groups }: { groups: AiAccuracyT['repeatGroups'] }) {
  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Jak często AI myli tę pozycję</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Ile pozycji</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Błąd razem</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Udział w błędzie</SummaryHeaderCell>
      {groups.flatMap((group) => [
        <SummaryCell key={`${group.groupOrder}-label`}>{group.howOften}</SummaryCell>,
        <SummaryCell key={`${group.groupOrder}-count`} className="text-right">
          {group.pozycje}
        </SummaryCell>,
        <SummaryCell key={`${group.groupOrder}-zl`} className="text-right">
          {formatPLN(group.wrongZl)}
        </SummaryCell>,
        <SummaryCell key={`${group.groupOrder}-share`} className="text-right">
          {formatWholePercent(group.sharePercent)}
        </SummaryCell>,
      ])}
    </SummaryTable>
  )
}
