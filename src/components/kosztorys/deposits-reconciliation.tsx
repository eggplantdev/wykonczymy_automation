'use client'

import { bucketDepositsByPlane, depositsSplit } from '@/lib/kosztorys/summary-economics'
import {
  SummaryHeaderCell,
  SummaryRow,
  SummaryTable,
  summaryMoneyCols,
} from '@/components/kosztorys/summary-grid'
import type { DepositTransactionRowT } from '@/types/reference-data'

type PropsT = {
  rows: DepositTransactionRowT[]
  // „Do rozliczenia netto" from the Rozliczenie mieszane table (the gotówka target, no VAT).
  cashTarget: number
  // „Reszta brutto" from the same table (the invoiced-with-VAT rest, before wpłaty).
  remainderGross: number
}

// Beside the wpłaty list in tryb mieszany: each VAT plane's deposits reconciled against its target
// from the „Rozliczenie mieszane" table. Netto deposits pay down the gotówka part, brutto deposits
// the invoiced part — so „Pozostało" is per-plane, not one figure on two axes.
export function DepositsReconciliation({ rows, cashTarget, remainderGross }: PropsT) {
  const { paidNet, paidGross } = bucketDepositsByPlane(rows)
  const split = depositsSplit(paidNet, paidGross, cashTarget, remainderGross)

  return (
    <SummaryTable cols={summaryMoneyCols('net')} className="w-fit self-start">
      <SummaryHeaderCell variant="label">Rozliczenie wpłat</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      <SummaryRow
        label="Wpłacono netto"
        hint="Wpłaty bez oznaczenia netto/brutto liczone są jako netto."
        line={{ net: split.paidNet, gross: split.paidNet }}
        axis="net"
        discount
      />
      <SummaryRow
        label="Wpłacono brutto"
        line={{ net: split.paidGross, gross: split.paidGross }}
        axis="net"
        discount
      />
      <SummaryRow
        label="Pozostało netto"
        hint="Do rozliczenia netto minus wpłacono netto"
        line={{ net: split.remainingNet, gross: split.remainingNet }}
        axis="net"
        bold
        danger={split.remainingNet > 0}
      />
      <SummaryRow
        label="Pozostało brutto"
        hint="Reszta brutto minus wpłacono brutto"
        line={{ net: split.remainingGross, gross: split.remainingGross }}
        axis="net"
        bold
        danger={split.remainingGross > 0}
      />
    </SummaryTable>
  )
}
