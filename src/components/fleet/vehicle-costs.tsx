import { Fragment } from 'react'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { summariseCosts } from '@/lib/fleet/costs'
import { emptyHistoryLabel } from '@/lib/fleet/history-window'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'
import { Description } from '@/components/ui/description'

const COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`

export function VehicleCosts({
  historyByType,
  fullHistoryByType,
}: {
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
  // the odometer readings this table leaves out must not make
  // an empty window look like a window that hid something.
  fullHistoryByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}) {
  const { byType, total, entries } = summariseCosts(historyByType)

  if (entries.length === 0) {
    const label = emptyHistoryLabel(
      'przeglądów',
      summariseCosts(fullHistoryByType).entries.length > 0,
    )
    return (
      <Description withIcon={false} size="xs">
        {label}
      </Description>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>Podsumowanie</h2>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Wpisy</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {byType.map((bucket) => (
            <Fragment key={bucket.type}>
              <SummaryCell>{INSPECTION_TYPE_LABELS[bucket.type].pl}</SummaryCell>
              <SummaryCell>{bucket.count}</SummaryCell>
              <SummaryCell>{formatPLNOrDash(bucket.total)}</SummaryCell>
            </Fragment>
          ))}

          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">{entries.length}</SummaryCell>
          <SummaryCell weight="bold">{formatPLNOrDash(total)}</SummaryCell>
        </SummaryTable>
      </div>

      <div>
        <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>Szczegóły</h2>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell>Data</SummaryHeaderCell>
          <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <SummaryCell>{formatPLDate(entry.performedAt)}</SummaryCell>
              <SummaryCell>{INSPECTION_TYPE_LABELS[entry.type].pl}</SummaryCell>
              <SummaryCell>{formatPLNOrDash(entry.cost)}</SummaryCell>
            </Fragment>
          ))}
        </SummaryTable>
      </div>
    </section>
  )
}
