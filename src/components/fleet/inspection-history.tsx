import { Fragment } from 'react'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { Paperclip } from 'lucide-react'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'
import { emptyHistoryLabel } from '@/lib/fleet/history-window'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { formatKm, formatKmOrDash } from '@/lib/utils/format-distance'
import type { InspectionHistoryEntryT, VehicleDetailT } from '@/lib/fleet/types'
import { Description } from '@/components/ui/description'

const columnsFor = (entries: InspectionHistoryEntryT[]) => ({
  insurer: entries.some((entry) => entry.insurer !== ''),
  policyNumber: entries.some((entry) => entry.policyNumber !== ''),
  attachments: entries.some((entry) => entry.attachmentCount > 0),
})

function HistoryTable({ entries }: { entries: InspectionHistoryEntryT[] }) {
  const shown = columnsFor(entries)
  const cols = [
    SUMMARY_LABEL_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    ...(shown.insurer ? [SUMMARY_VALUE_COL] : []),
    ...(shown.policyNumber ? [SUMMARY_VALUE_COL] : []),
    ...(shown.attachments ? [SUMMARY_VALUE_COL] : []),
  ].join(' ')

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell>Data</SummaryHeaderCell>
      <SummaryHeaderCell>Następny termin</SummaryHeaderCell>
      <SummaryHeaderCell>Przebieg</SummaryHeaderCell>
      <SummaryHeaderCell>Od poprzedniego</SummaryHeaderCell>
      <SummaryHeaderCell>Koszt</SummaryHeaderCell>
      {shown.insurer && <SummaryHeaderCell>Ubezpieczyciel</SummaryHeaderCell>}
      {shown.policyNumber && <SummaryHeaderCell>Nr polisy</SummaryHeaderCell>}
      {shown.attachments && <SummaryHeaderCell>Załączniki</SummaryHeaderCell>}

      {entries.map((entry) => (
        <Fragment key={entry.id}>
          <SummaryCell weight="medium" note={entry.note ? { text: entry.note } : null}>
            {formatPLDate(entry.performedAt)}
          </SummaryCell>

          <SummaryCell>{entry.nextDueAt ? formatPLDate(entry.nextDueAt) : EMPTY_VALUE}</SummaryCell>

          <SummaryCell>{formatKmOrDash(entry.odometer)}</SummaryCell>

          <SummaryCell>
            {entry.kmSincePrevious !== null ? `+${formatKm(entry.kmSincePrevious)}` : EMPTY_VALUE}
          </SummaryCell>

          <SummaryCell>{formatPLNOrDash(entry.cost)}</SummaryCell>

          {shown.insurer && <SummaryCell>{entry.insurer || EMPTY_VALUE}</SummaryCell>}

          {shown.policyNumber && <SummaryCell>{entry.policyNumber || EMPTY_VALUE}</SummaryCell>}

          {shown.attachments && (
            <SummaryCell>
              {entry.attachmentCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {entry.attachmentCount}
                </span>
              ) : (
                EMPTY_VALUE
              )}
            </SummaryCell>
          )}
        </Fragment>
      ))}
    </SummaryTable>
  )
}

export function InspectionHistory({
  historyByType,
  fullHistoryByType,
}: Pick<VehicleDetailT, 'historyByType'> & {
  fullHistoryByType: VehicleDetailT['historyByType']
}) {
  return (
    <div className="flex flex-col gap-6">
      {INSPECTION_TYPES.map((type) => (
        <div key={type}>
          <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>{INSPECTION_TYPE_LABELS[type].pl}</h2>

          {historyByType[type].length === 0 ? (
            <Description withIcon={false} size="xs">
              {emptyHistoryLabel('wpisów', fullHistoryByType[type].length > 0)}
            </Description>
          ) : (
            <HistoryTable entries={historyByType[type]} />
          )}
        </div>
      ))}
    </div>
  )
}
