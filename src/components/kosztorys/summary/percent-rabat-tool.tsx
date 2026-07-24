'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { HintTooltip } from '@/components/ui/tooltip'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

const TIP = 'Wpisuje ten sam rabat w rabat KAŻDEJ pozycji (nadpisuje istniejące).'

// A per-item rabat can't take effect while an amount „Rabat całościowy" is active — it overrides and
// hides per-item rabaty — so applying a percent would silently do nothing. Block it and say why.
const DISABLED_TIP = 'Wyłączone, dopóki działa rabat kwotowy'

type PropsT = {
  // Resolves true when the bulk write landed — the input clears only then.
  onApply: (percent: number) => Promise<boolean>
  // An active amount global discount overrides per-item rabaty, so a percent apply would be a no-op.
  disabled?: boolean
}

// One-shot percent-rabat bulk-apply: a value the user types applies to every item's per-item rabat,
// unlike the stored „Rabat całościowy" beside it. A checkbox reveals the input (nothing is stored, so
// this is pure disclosure); the controlled input clears on success and the parent handler owns the
// optimistic grid patch and rollback.
export function PercentRabatTool({ onApply, disabled = false }: PropsT) {
  const [enabled, setEnabled] = useState(false)
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)

  const parsed = parseDecimalInput(raw)
  const percent = parsed.kind === 'value' ? parsed.value : null
  const valid = percent != null && applyPercentRabatSchema.safeParse({ percent }).success
  // An active amount discount overrides per-item rabaty, so the whole tool is unavailable then.
  const open = enabled && !disabled

  async function apply() {
    if (!valid || pending) return
    setPending(true)
    const ok = await onApply(percent)
    setPending(false)
    if (ok) setRaw('')
  }

  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={open}
          disabled={disabled}
          onCheckedChange={(c) => setEnabled(c === true)}
        />
        <HintTooltip
          content={disabled ? DISABLED_TIP : TIP}
          className="text-muted-foreground text-xs"
        >
          Rabat %
        </HintTooltip>
      </label>
      {open && (
        <>
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
            className="border-border text-chart-green h-6 w-14 rounded border bg-transparent px-1 text-right text-xs outline-none disabled:cursor-not-allowed"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!valid || pending}
            onClick={() => void apply()}
          >
            Zastosuj
          </Button>
        </>
      )}
    </div>
  )
}
