import { computeCashSettlement } from '@/lib/kosztorys/summary-economics'
import { Input } from '@/components/ui/input'
import {
  SummaryHeaderCell,
  SummaryRow,
  SummaryTable,
  summaryMoneyCols,
  SUMMARY_LABEL_CELL,
  SUMMARY_VALUE_CELL,
} from '@/components/kosztorys/summary-grid'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  // „Do zapłaty" BRUTTO — the still-owed R+M figure the cash split works against. Brutto (not netto)
  // because C = 0 must land on the Brutto axis „Do zapłaty"; see computeCashSettlement.
  doZaplatyGross: number
  vatRate: number
  cashAmount: number
  onCashAmountChange: (n: number) => void
  // Client preview: the input renders but can't be edited.
  readOnly: boolean
}

// Tryb mieszany: „Gotówką bez VAT" (C, editable) + „Reszta z VAT" ((D−C)·(1+VAT)) + „Razem do
// zapłaty" (C + reszta). Built on the shared netto single-value track so it lines up with the
// waterfall grid above it.
export function CashSettlement({
  doZaplatyGross,
  vatRate,
  cashAmount,
  onCashAmountChange,
  readOnly,
}: PropsT) {
  const settlement = computeCashSettlement(doZaplatyGross, cashAmount, vatRate)

  return (
    <SummaryTable cols={summaryMoneyCols('net')} className="w-fit self-start">
      <SummaryHeaderCell variant="label">Rozliczenie gotówką</SummaryHeaderCell>
      <SummaryHeaderCell>kwota</SummaryHeaderCell>

      <span className={SUMMARY_LABEL_CELL}>Gotówką bez VAT</span>
      <span className={cn(SUMMARY_VALUE_CELL, 'p-0')}>
        <Input
          type="number"
          min={0}
          step="0.01"
          readOnly={readOnly}
          value={cashAmount}
          onChange={(e) => onCashAmountChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-full rounded-none border-0 bg-transparent text-right tabular-nums focus-visible:ring-0"
          aria-label="Kwota gotówką bez VAT"
        />
      </span>

      <SummaryRow
        label="Reszta z VAT"
        line={{ net: settlement.remainderGross, gross: settlement.remainderGross }}
        axis="net"
        noShareCell
      />
      <SummaryRow
        label="Razem do zapłaty"
        line={{ net: settlement.total, gross: settlement.total }}
        axis="net"
        noShareCell
        bold
      />
    </SummaryTable>
  )
}
