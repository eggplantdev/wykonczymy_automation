import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell } from '@/components/ui/summary-grid'

export function SummaryMoneyHeaders({ axis }: { axis: MoneyAxisT }) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  return (
    <>
      {showNet && (
        <SummaryHeaderCell className="text-foreground font-bold">Netto</SummaryHeaderCell>
      )}
      {showGross && (
        <SummaryHeaderCell className="text-foreground font-bold">Brutto</SummaryHeaderCell>
      )}
    </>
  )
}
