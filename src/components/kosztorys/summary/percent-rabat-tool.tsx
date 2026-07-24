'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HintTooltip } from '@/components/ui/tooltip'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

const TIP = [
  'Wpisuje ten sam rabat procentowy w rabat KAŻDEJ pozycji (nadpisuje istniejące).',
  'To jednorazowe narzędzie — nic nie zostaje zapisane globalnie, pozycje edytujesz dalej ręcznie.',
].join('\n')

type PropsT = {
  // Resolves true when the bulk write landed — the input clears only then.
  onApply: (percent: number) => Promise<boolean>
}

// One-shot percent-rabat bulk-apply: a value the user types applies to every item's per-item rabat,
// unlike the stored „Rabat całościowy" beside it. Controlled input (so it can clear on success) with
// its own pending guard — the parent handler owns the optimistic grid patch and rollback.
export function PercentRabatTool({ onApply }: PropsT) {
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)

  const parsed = parseDecimalInput(raw)
  const percent = parsed.kind === 'value' ? parsed.value : null
  const valid = percent != null && percent > 0 && percent <= 100

  async function apply() {
    if (!valid || pending) return
    setPending(true)
    const ok = await onApply(percent)
    setPending(false)
    if (ok) setRaw('')
  }

  return (
    <div className="flex items-center gap-2">
      <HintTooltip content={TIP} className="text-muted-foreground text-xs">
        Rabat % na wszystkie pozycje
      </HintTooltip>
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        placeholder="%"
        disabled={pending}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void apply()
        }}
        className="border-border text-chart-green h-6 w-14 rounded border bg-transparent px-1 text-right text-xs outline-none"
      />
      <Button variant="outline" size="sm" disabled={!valid || pending} onClick={() => void apply()}>
        Zastosuj
      </Button>
    </div>
  )
}
