import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { formatQty } from '@/lib/kosztorys/format'
import type { MaterialShopPriceT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import { shopColor } from './material-shop-colors'

const COLS = `${SUMMARY_NAME_COL} repeat(6, ${SUMMARY_VALUE_COL})`

type PropsT = {
  shops: MaterialShopPriceT[]
  cheapestShop: string
}

export function MaterialShopsTable({ shops, cheapestShop }: PropsT) {
  const isCompared = shops.length > 1

  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Sklep</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Zakupy</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Ilość</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Średnio netto</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Min</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Max</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Ostatnio</SummaryHeaderCell>
      {shops.flatMap((shop, rank) => {
        const isCheapest = isCompared && shop.shop === cheapestShop
        return [
          <SummaryCell key={`${shop.shop}-name`}>
            <span className="flex items-center gap-2">
              <span className={cn('size-2.5 shrink-0 rounded-xs', shopColor(rank).swatch)} />
              {shop.shop}
            </span>
          </SummaryCell>,
          <SummaryCell key={`${shop.shop}-orders`} className="text-right">
            {shop.orders}
          </SummaryCell>,
          <SummaryCell key={`${shop.shop}-qty`} className="text-right">
            {formatQty(shop.qty)}
          </SummaryCell>,
          <SummaryCell
            key={`${shop.shop}-avg`}
            className="text-right"
            tone={isCheapest ? 'success' : undefined}
            weight={isCheapest ? 'bold' : undefined}
          >
            {formatPLN(shop.avgNet)}
          </SummaryCell>,
          <SummaryCell key={`${shop.shop}-min`} className="text-right">
            {formatPLN(shop.minNet)}
          </SummaryCell>,
          <SummaryCell key={`${shop.shop}-max`} className="text-right">
            {formatPLN(shop.maxNet)}
          </SummaryCell>,
          <SummaryCell key={`${shop.shop}-last`} className="text-right">
            {formatPLN(shop.lastNet)}
            <span className="text-muted-foreground block text-xs">{shop.lastDate}</span>
          </SummaryCell>,
        ]
      })}
    </SummaryTable>
  )
}
