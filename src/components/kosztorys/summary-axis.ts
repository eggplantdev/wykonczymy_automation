import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/ui/summary-grid'

// Which money side is inactive (greyed) while both columns show. `undefined` = neither (Mieszane).
export type MutedAxisT = 'net' | 'gross' | undefined

type MoneySideT = 'net' | 'gross'

// Render order for the two money columns: the ACTIVE side sits first, right beside the label; the
// inactive (muted) side follows. So Brutto mode swaps Brutto ahead of Netto. Mieszane (no muted side)
// keeps the natural netto → brutto order. Both columns share one width, so reordering the cells is
// all it takes — the grid track list is unchanged.
export function orderedMoneySides(mutedAxis: MutedAxisT): MoneySideT[] {
  return mutedAxis === 'net' ? ['gross', 'net'] : ['net', 'gross']
}

// The money tracks appear only for the axis on show; the label track is fixed so this grid and the
// etap-totals grid above it keep their first columns aligned.
export function summaryMoneyCols(axis: MoneyAxisT): string {
  const { net, gross } = axisShows(axis)
  return [SUMMARY_LABEL_COL, net && SUMMARY_VALUE_COL, gross && SUMMARY_VALUE_COL]
    .filter(Boolean)
    .join(' ')
}
