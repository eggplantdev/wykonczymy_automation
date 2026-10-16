import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/ui/summary-grid'

export function summaryMoneyCols(axis: MoneyAxisT): string {
  const { net, gross } = axisShows(axis)
  return [SUMMARY_LABEL_COL, net && SUMMARY_VALUE_COL, gross && SUMMARY_VALUE_COL]
    .filter(Boolean)
    .join(' ')
}
