import { RATE_LABELS } from '@/lib/kosztorys/labels'
import { catalogueRateText } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import {
  NO_CATEGORY,
  type CataloguePricesT,
} from '@/lib/kosztorys/work-catalogue/catalogue-overwrite-text'
import { formatPLN } from '@/lib/utils/format-currency'

// An EMPTY kategoria is a value like any other — hence `undefined` (not falsiness) hides the row, so
// „bez kategorii" still renders on both sides.
export function PriceList({
  title,
  prices,
  category,
}: {
  title: string
  prices: CataloguePricesT
  category?: string | null
}) {
  const rows: [string, string, boolean][] = [
    ['Cena j.m.', formatPLN(prices.clientPrice), true],
    [RATE_LABELS.w_tools, catalogueRateText(prices, 'w_tools'), true],
    [RATE_LABELS.own_tools, catalogueRateText(prices, 'own_tools'), true],
    ...(category !== undefined
      ? ([['Kategoria', category || NO_CATEGORY, false]] as [string, string, boolean][])
      : []),
  ]
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{title}</p>
      {rows.map(([label, value, numeric]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={numeric ? 'tabular-nums' : undefined}>{value}</span>
        </div>
      ))}
    </div>
  )
}
