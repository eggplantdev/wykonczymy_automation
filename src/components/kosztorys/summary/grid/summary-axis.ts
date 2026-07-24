import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/ui/summary-grid'

// The money tracks appear only for the axis on show; the label track is fixed so this grid and the
// etap-totals grid above it keep their first columns aligned.
export function summaryMoneyCols(axis: MoneyAxisT): string {
  const { net, gross } = axisShows(axis)
  return [SUMMARY_LABEL_COL, net && SUMMARY_VALUE_COL, gross && SUMMARY_VALUE_COL]
    .filter(Boolean)
    .join(' ')
}
