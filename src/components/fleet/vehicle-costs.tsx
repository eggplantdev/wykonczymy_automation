import { Fragment } from 'react'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { summariseCosts } from '@/lib/fleet/costs'
import { emptyHistoryLabel } from '@/lib/fleet/history-window'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

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
    return <p className="text-muted-foreground text-xs">{label}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Podsumowanie</h2>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Wpisy</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {byType.map((bucket) => (
            <Fragment key={bucket.type}>
              <SummaryLabelCell>{INSPECTION_TYPE_LABELS[bucket.type].pl}</SummaryLabelCell>
              <SummaryValueCell>{bucket.count}</SummaryValueCell>
              <SummaryValueCell>{formatPLNOrDash(bucket.total)}</SummaryValueCell>
            </Fragment>
          ))}

          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold">{entries.length}</SummaryValueCell>
          <SummaryValueCell weight="bold">{formatPLNOrDash(total)}</SummaryValueCell>
        </SummaryTable>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Szczegóły</h3>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Data</SummaryHeaderCell>
          <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <SummaryLabelCell className="tabular-nums">
                {formatPLDate(entry.performedAt)}
              </SummaryLabelCell>
              <SummaryValueCell>{INSPECTION_TYPE_LABELS[entry.type].pl}</SummaryValueCell>
              <SummaryValueCell>{formatPLNOrDash(entry.cost)}</SummaryValueCell>
            </Fragment>
          ))}
        </SummaryTable>
      </div>
    </section>
  )
}
