'use client'

import { HintTooltip } from '@/components/ui/tooltip'

type PropsT = {
  label: string
  // Optional explanatory tooltip on the LABEL only — the input stays a clean text field.
  hint?: string
  value: number | null
  placeholder?: number
  nullable?: boolean
  onCommit: (n: number | null) => void
}

// Markup-coefficient field. Uncontrolled + `key` on the value (remount after router.refresh),
// commit on blur/Enter — no useEffect (project rule). Empty + nullable = inherit (null).
export function CoeffField({ label, hint, value, placeholder, nullable, onCommit }: PropsT) {
  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      {hint ? <HintTooltip content={hint}>{label}</HintTooltip> : label}
      <input
        key={value == null ? 'null' : String(value)}
        type="text"
        inputMode="decimal"
        defaultValue={value == null ? '' : String(value)}
        placeholder={placeholder != null ? String(placeholder) : ''}
        className="border-border h-6 w-14 rounded border bg-transparent px-1 text-right text-xs outline-none"
        onBlur={(e) => {
          const raw = e.target.value.trim().replace(',', '.')
          if (raw === '') {
            if (nullable) onCommit(null)
            return
          }
          const n = Number(raw)
          if (!Number.isNaN(n)) onCommit(n)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}
