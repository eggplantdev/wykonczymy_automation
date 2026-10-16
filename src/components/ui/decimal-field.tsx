'use client'

import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { cn } from '@/lib/utils/cn'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { NOTICE_MS, rejectedEntryMessage } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

type EntryT = { kind: 'commit'; value: number } | { kind: 'reject' } | { kind: 'none' }

type PropsT = {
  label?: ReactNode
  labelAbove?: boolean
  hint?: string
  suffix?: ReactNode
  value: number | null
  placeholder?: number
  valueClassName?: string
  // Never clamp in `onCommit`: „230" meant „23", and saving 100% keeps a number nobody typed.
  min?: number
  max?: number
  // Without it, blanking the input is a silent no-op — the field looks empty while the old value is still stored.
  emptyAs?: number
  withSave?: boolean
  disabled?: boolean
  onCommit: (n: number) => void
}

export function DecimalField({
  label,
  labelAbove = false,
  hint,
  suffix,
  value,
  placeholder,
  valueClassName,
  min,
  max,
  emptyAs,
  withSave = false,
  disabled = false,
  onCommit,
}: PropsT) {
  const text = value == null ? '' : String(value)
  const [typed, setTyped] = useState<string | null>(null)
  // Resync so the button can't stay armed over an edit the field no longer shows.
  const [seenText, setSeenText] = useState(text)
  if (seenText !== text) {
    setSeenText(text)
    setTyped(null)
  }

  // Bumped to remount the input on a restore: its `key` only moves when `value` CHANGES, so a refused entry would otherwise stay on screen as text the app has not accepted.
  const [restores, setRestores] = useState(0)

  const outOfRange = (n: number) => (min != null && n < min) || (max != null && n > max)

  const entryOf = (raw: string): EntryT => {
    const parsed = parseDecimalInput(raw)
    if (parsed.kind === 'empty')
      return emptyAs == null ? { kind: 'none' } : { kind: 'commit', value: emptyAs }
    if (parsed.kind === 'invalid' || outOfRange(parsed.value)) return { kind: 'reject' }
    return { kind: 'commit', value: parsed.value }
  }

  const pending = typed == null || typed === text ? null : entryOf(typed)
  const canSave = pending != null && pending.kind !== 'none'

  const restore = () => {
    setTyped(null)
    setRestores((count) => count + 1)
  }

  const settle = (entry: EntryT) => {
    if (entry.kind === 'commit') return onCommit(entry.value)
    if (entry.kind === 'reject') {
      const restored =
        value == null
          ? null
          : // Full precision, because `toLocaleString`'s default stops at 3 decimals while the input
            // restores all of them.
            `${value.toLocaleString('pl-PL', { maximumFractionDigits: 20 })}${
              typeof suffix === 'string' ? suffix : ''
            }`
      toastMessage(rejectedEntryMessage(restored), 'error', NOTICE_MS)
    }
    restore()
  }

  return (
    <label
      className={cn(
        'text-muted-foreground flex gap-1 text-xs',
        labelAbove ? 'flex-col items-start' : 'items-center',
      )}
    >
      {(label || hint) && (
        <span className="flex items-center gap-1">
          {label}
          {hint && <InfoTooltip content={hint} />}
        </span>
      )}
      <span className="flex items-center gap-1">
        <DecimalInput
          key={`${text || 'null'}:${restores}`}
          defaultValue={text}
          placeholder={placeholder != null ? String(placeholder) : ''}
          className={cn(withSave && 'rounded-md', valueClassName)}
          disabled={disabled}
          onChange={withSave ? (e) => setTyped(e.target.value) : undefined}
          onBlur={withSave ? undefined : (e) => settle(entryOf(e.target.value))}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== 'Enter') return
            if (!withSave) e.currentTarget.blur()
            else if (canSave) settle(pending)
          }}
        />
        {suffix}
        {withSave && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={disabled || !canSave}
            onClick={() => canSave && settle(pending)}
          >
            Zapisz
          </Button>
        )}
      </span>
    </label>
  )
}
