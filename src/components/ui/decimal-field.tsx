'use client'

import type { FocusEvent, KeyboardEvent } from 'react'
import { HintTooltip } from '@/components/ui/tooltip'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  label: string
  // Optional explanatory tooltip on the LABEL only — the input stays a clean text field.
  hint?: string
  value: number | null
  placeholder?: number
  // Colours the value only; a direct color on the input overrides the muted colour the label inherits.
  valueClassName?: string
  onCommit: (n: number) => void
}

// Decimal-number field. Uncontrolled + `key` on the value (remount after router.refresh),
// commit on blur/Enter — no useEffect (project rule).
export function DecimalField({
  label,
  hint,
  value,
  placeholder,
  valueClassName,
  onCommit,
}: PropsT) {
  const commit = (e: FocusEvent<HTMLInputElement>) => {
    const parsed = parseDecimalInput(e.target.value)
    if (parsed.kind === 'value') onCommit(parsed.value)
  }

  const commitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      {hint ? <HintTooltip content={hint}>{label}</HintTooltip> : label}
      <input
        key={value == null ? 'null' : String(value)}
        type="text"
        inputMode="decimal"
        defaultValue={value == null ? '' : String(value)}
        placeholder={placeholder != null ? String(placeholder) : ''}
        className={`border-border h-6 w-14 rounded border bg-transparent px-1 text-right text-xs outline-none ${valueClassName ?? ''}`}
        onBlur={commit}
        onKeyDown={commitOnEnter}
      />
    </label>
  )
}
