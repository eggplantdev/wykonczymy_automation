import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell } from '@/components/ui/summary-grid'

// The Netto/Brutto header pair, shown only for the axis on display. Shared by every summary grid so
// the header copy lives in one place. Mieszane shows both; net/gross show their single column.
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
