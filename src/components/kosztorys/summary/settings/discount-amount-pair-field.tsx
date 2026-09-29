'use client'

import { type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { toGross, toNet } from '@/lib/kosztorys/calc'
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

const moneyText = (amount: number) => String(roundToCents(amount))

function parsedAmount(raw: string): number | null {
  const parsed = parseDecimalInput(raw)
  return parsed.kind === 'value' && parsed.value >= 0 ? parsed.value : null
}

// The owner types the kwota on whichever axis the deal was agreed in; the other field shows its
// counterpart live. Only the netto is stored, so a brutto entry commits `toNet` at full precision —
// crossing through a grosz-rounded netto would re-gross a grosz off what was typed.
// Commits only through „Zapisz" or Enter, never on blur, like DiscountValueField.
export function DiscountAmountPairField({ value, vatRate, disabled = false, onApply }: PropsT) {
  const storedNet = moneyText(value)
  const storedGross = moneyText(toGross(value, vatRate))

  const [net, setNet] = useState(storedNet)
  const [gross, setGross] = useState(storedGross)
  const [edited, setEdited] = useState<AxisT | null>(null)

  // Undo, a rolled-back save, a mode reseed or a new stawka VAT all move the stored pair without
  // touching these inputs — resync so neither shows a figure that is no longer stored.
  const seenKey = `${value}|${vatRate}`
  const [seen, setSeen] = useState(seenKey)
  if (seen !== seenKey) {
    setSeen(seenKey)
    setNet(storedNet)
    setGross(storedGross)
    setEdited(null)
  }

  function typeNet(raw: string) {
    setNet(raw)
    setEdited('net')
    const amount = parsedAmount(raw)
    setGross(amount == null ? '' : moneyText(toGross(amount, vatRate)))
  }

  function typeGross(raw: string) {
    setGross(raw)
    setEdited('gross')
    const amount = parsedAmount(raw)
    setNet(amount == null ? '' : moneyText(toNet(amount, vatRate)))
  }

  const typed = edited === 'net' ? parsedAmount(net) : edited === 'gross' ? parsedAmount(gross) : null
  // Compared as text against the stored pair so „Zapisz" stays inert until something changed.
  const changed = edited === 'net' ? net !== storedNet : gross !== storedGross
  const canApply = typed != null && changed

  function apply() {
    if (!canApply || typed == null) return
    onApply(edited === 'gross' ? toNet(typed, vatRate) : typed)
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
          onChange={(e) => typeNet(e.target.value)}
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
          onChange={(e) => typeGross(e.target.value)}
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
