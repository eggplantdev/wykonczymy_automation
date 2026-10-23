import Link from 'next/link'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { TextLink } from '@/components/ui/text-link'
import { formatQty } from '@/lib/kosztorys/format'
import type { MaterialPurchaseT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'

const COLS = `repeat(3, ${SUMMARY_VALUE_COL}) ${SUMMARY_NAME_COL} repeat(3, ${SUMMARY_VALUE_COL})`

type PropsT = {
  purchases: MaterialPurchaseT[]
  investmentNames: ReadonlyMap<number, string>
}

export function MaterialPurchasesTable({ purchases, investmentNames }: PropsT) {
  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell>Data</SummaryHeaderCell>
      <SummaryHeaderCell>Sklep</SummaryHeaderCell>
      <SummaryHeaderCell>Dokument</SummaryHeaderCell>
      <SummaryHeaderCell>Inwestycja</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Ilość</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Netto / szt.</SummaryHeaderCell>
      <SummaryHeaderCell className="text-right">Brutto</SummaryHeaderCell>
      {purchases.toReversed().flatMap((purchase, index) => {
        const key = `${purchase.doc}-${index}`
        const name = purchase.investmentId && investmentNames.get(purchase.investmentId)
        return [
          <SummaryCell key={`${key}-date`}>{purchase.date}</SummaryCell>,
          <SummaryCell key={`${key}-shop`}>{purchase.shop}</SummaryCell>,
          <SummaryCell key={`${key}-doc`} className="text-muted-foreground">
            {purchase.doc}
          </SummaryCell>,
          <SummaryCell key={`${key}-investment`}>
            {name ? (
              <TextLink asChild>
                <Link href={`/inwestycje/${purchase.investmentId}`}>{name}</Link>
              </TextLink>
            ) : (
              <span className="text-muted-foreground">bez inwestycji</span>
            )}
          </SummaryCell>,
          <SummaryCell
            key={`${key}-qty`}
            className="text-right"
            note={purchase.odd ? { text: 'przeliczone z innego opakowania' } : undefined}
          >
            {formatQty(purchase.qty)}
          </SummaryCell>,
          <SummaryCell key={`${key}-net`} className="text-right">
            {formatPLN(purchase.net)}
          </SummaryCell>,
          <SummaryCell key={`${key}-gross`} className="text-right">
            {formatPLN(purchase.gross)}
          </SummaryCell>,
        ]
      })}
    </SummaryTable>
  )
}
