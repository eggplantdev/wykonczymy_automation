'use client'

import type { FocusEvent, KeyboardEvent } from 'react'
import { computeCashSettlement } from '@/lib/kosztorys/summary-economics'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
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
  // Łącznie netto (robocizna + materiały) — the VATable base the cash split starts from.
  combinedNet: number
  // Investor's wpłaty (face value, no VAT) — subtracted after grossing, never grossed.
  wplatyNet: number
  vatRate: number
  cashAmount: number
  onCashAmountChange: (n: number) => void
  // Client preview: the input renders but can't be edited.
  readOnly: boolean
}

// Tryb mieszany: an explicit cash-vs-invoice waterfall so every figure reconstructs from the one
// above it — Wartość netto → − gotówka → Pozostałe netto → + VAT → Pozostałe z VAT → − wpłaty →
// Do zapłaty fakturą → + gotówka → Razem. Built on the shared netto single-value track so it lines
// up with the grid to its left. The C input follows the editor's CoeffField convention: uncontrolled
// text + inputMode decimal, commit on blur/Enter (so a partial „1." or a cleared field never fights
// the typist), `key` to remount on the committed value.
export function CashSettlement({
  combinedNet,
  wplatyNet,
  vatRate,
  cashAmount,
  onCashAmountChange,
  readOnly,
}: PropsT) {
  const settlement = computeCashSettlement(combinedNet, wplatyNet, cashAmount, vatRate)
  const vatPercent = Math.round(vatRate * 100)

  const commit = (e: FocusEvent<HTMLInputElement>) => {
    const parsed = parseDecimalInput(e.target.value)
    if (parsed.kind === 'empty') {
      onCashAmountChange(0)
      return
    }
    if (parsed.kind === 'value') onCashAmountChange(Math.max(0, parsed.value))
  }

  const commitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

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
      <span className={SUMMARY_LABEL_CELL}>Do rozliczenia netto</span>
      <span className={cn(SUMMARY_VALUE_CELL, 'p-0')}>
        <input
          key={String(cashAmount)}
          type="text"
          inputMode="decimal"
          readOnly={readOnly}
          defaultValue={cashAmount === 0 ? '' : String(cashAmount)}
          placeholder="0"
          className="h-full w-full bg-transparent px-3 py-1 text-right tabular-nums outline-none"
          onBlur={commit}
          onKeyDown={commitOnEnter}
          aria-label="Kwota gotówką bez VAT"
        />
      </span>
      <SummaryRow
        label="Reszta netto "
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
      {/* <SummaryRow
        label="Do zapłaty gotówką"
        hint="Kwota rozliczana gotówką (bez VAT)"
        line={{ net: settlement.cash, gross: settlement.cash }}
        axis="net"
      />
      <SummaryRow
        label="Do zapłaty faktura"
        hint="Pozostałe z VAT − wpłaty"
        line={{ net: settlement.invoice, gross: settlement.invoice }}
        axis="net"
        danger={settlement.invoice > 0}
      /> */}
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
