import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell } from '@/components/ui/summary-grid'
import { orderedMoneySides, type MutedAxisT } from '@/components/kosztorys/summary-axis'

// The Netto/Brutto header pair, in active-first order, with the active one black+bold and the muted
// one greyed. Shared by every summary grid that shows both money columns so the ordering/emphasis
// rule lives in one place.
export function SummaryMoneyHeaders({
  axis,
  mutedAxis,
}: {
  axis: MoneyAxisT
  mutedAxis?: MutedAxisT
}) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  return (
    <>
      {orderedMoneySides(mutedAxis).map((side) => {
        if (side === 'net' ? !showNet : !showGross) return null
        return (
          <SummaryHeaderCell
            key={side}
            muted={mutedAxis === side}
            className={mutedAxis === side ? undefined : 'text-foreground font-bold'}
          >
            {side === 'net' ? 'Netto' : 'Brutto'}
          </SummaryHeaderCell>
        )
      })}
    </>
  )
}
