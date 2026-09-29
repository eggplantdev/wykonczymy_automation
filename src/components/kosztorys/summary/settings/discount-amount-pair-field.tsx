'use client'

import { type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { discountNetFromGross, toGross, toNet } from '@/lib/kosztorys/calc'
import { moneyText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { roundToCents } from '@/lib/utils/round-to-cents'

type AxisT = 'net' | 'gross'

type PropsT = {
  // The stored kwota, always netto.
  value: number
  vatRate: number
  disabled?: boolean
  onApply: (net: number) => void
}

function parsedAmount(raw: string): number | null {
  const parsed = parseDecimalInput(raw)
  return parsed.kind === 'value' && parsed.value >= 0 ? parsed.value : null
}

// Only the netto is stored, so a brutto entry commits `discountNetFromGross` at six places — crossing
// through a grosz-rounded netto would re-gross a grosz off what was typed.
export function DiscountAmountPairField({ value, vatRate, disabled = false, onApply }: PropsT) {
  const storedNet = moneyText(value)
  const storedGross = moneyText(toGross(value, vatRate))

  // The text typed on one axis; the other field is derived from it.
  const [draft, setDraft] = useState<{ axis: AxisT; raw: string } | null>(null)

  // Undo, a rolled-back save, a mode reseed or a new stawka VAT all move the stored pair without
  // touching these inputs — drop the draft so neither shows a figure that is no longer stored.
  const seenKey = `${value}|${vatRate}`
  const [seen, setSeen] = useState(seenKey)
  if (seen !== seenKey) {
    setSeen(seenKey)
    setDraft(null)
  }

  const typed = draft == null ? null : parsedAmount(draft.raw)
  const counterpart =
    draft == null || typed == null
      ? ''
      : moneyText(draft.axis === 'net' ? toGross(typed, vatRate) : toNet(typed, vatRate))
  const net = draft == null ? storedNet : draft.axis === 'net' ? draft.raw : counterpart
  const gross = draft == null ? storedGross : draft.axis === 'gross' ? draft.raw : counterpart
  const canApply =
    draft != null && typed != null && draft.raw !== (draft.axis === 'net' ? storedNet : storedGross)

  function apply() {
    if (!canApply) return
    onApply(draft.axis === 'gross' ? discountNetFromGross(typed, vatRate) : roundToCents(typed))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') apply()
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
      <label className="flex items-center gap-1">
        netto
        <DecimalInput
          value={net}
          placeholder="zł"
          disabled={disabled}
          onChange={(e) => setDraft({ axis: 'net', raw: e.target.value })}
          onKeyDown={onKeyDown}
          className="text-chart-green rounded-md"
        />
        zł
      </label>
      <label className="flex items-center gap-1">
        brutto
        <DecimalInput
          value={gross}
          placeholder="zł"
          disabled={disabled}
          onChange={(e) => setDraft({ axis: 'gross', raw: e.target.value })}
          onKeyDown={onKeyDown}
          className="text-chart-green rounded-md"
        />
        zł
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={disabled || !canApply}
        onClick={apply}
      >
        Zapisz
      </Button>
    </div>
  )
}
