import { computeCashSettlement } from '@/lib/kosztorys/summary-economics'
import {
  SummaryHeaderCell,
  SummaryRow,
  SummaryTable,
  summaryMoneyCols,
} from '@/components/kosztorys/summary-grid'

type PropsT = {
  // Łącznie netto (robocizna + materiały) — the VATable base the cash split starts from.
  combinedNet: number
  // Investor's wpłaty (face value, no VAT) — subtracted after grossing, never grossed.
  wplatyNet: number
  vatRate: number
  // Σ deposits flagged NET — the gotówka part, derived from the wpłaty list, not typed.
  cashAmount: number
}

// Tryb mieszany: an explicit cash-vs-invoice waterfall so every figure reconstructs from the one
// above it — Wartość netto → − gotówka → Pozostałe netto → + VAT → Pozostałe z VAT → − wpłaty →
// Do zapłaty fakturą → + gotówka → Razem. Built on the shared netto single-value track so it lines
// up with the grid to its left.
export function CashSettlement({ combinedNet, wplatyNet, vatRate, cashAmount }: PropsT) {
  const settlement = computeCashSettlement(combinedNet, wplatyNet, cashAmount, vatRate)
  const vatPercent = Math.round(vatRate * 100)

  return (
    <SummaryTable cols={summaryMoneyCols('net')} className="w-fit self-start">
      <SummaryHeaderCell variant="label">Rozliczenie mieszane</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      <SummaryRow
        label="Całość netto"
        hint="Łącznie netto (robocizna + materiały)"
        line={{ net: settlement.combinedNet, gross: settlement.combinedNet }}
        axis="net"
      />
      <SummaryRow
        label="Do rozliczenia netto"
        hint="Suma wpłat netto (wpłaty bez oznaczenia liczone są jako netto)"
        line={{ net: settlement.cash, gross: settlement.cash }}
        axis="net"
      />
      <SummaryRow
        label="Reszta netto"
        hint="Wartość netto − gotówka"
        line={{ net: settlement.remainderNet, gross: settlement.remainderNet }}
        axis="net"
      />
      <SummaryRow
        label="Reszta brutto"
        hint={`Pozostałe netto + VAT ${vatPercent}%`}
        line={{ net: settlement.remainderGross, gross: settlement.remainderGross }}
        axis="net"
      />
      <SummaryRow label="Wpłaty" line={{ net: wplatyNet, gross: wplatyNet }} axis="net" discount />
      <SummaryRow
        label="Razem do zapłaty"
        hint="Do zapłaty fakturą + gotówka"
        line={{ net: settlement.total, gross: settlement.total }}
        axis="net"
        bold
        danger={settlement.total > 0}
      />
    </SummaryTable>
  )
}
