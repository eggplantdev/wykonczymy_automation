'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DecimalInput } from '@/components/ui/decimal-input'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  // Omitted where an enclosing block already names the figure — the suffix („zł"/„%") is the only
  // thing that still distinguishes the two rabat modes at the input.
  label?: ReactNode
  // Unit printed after the input, BEFORE „Zapisz" — same order as DecimalField, so the two kinds of
  // number field in the settings popover read as one control rather than two near-misses.
  suffix?: ReactNode
  // The stored figure to show. '' for the percent tool, which stamps into the items and stores nothing.
  value: string
  placeholder?: string
  disabled?: boolean
  isValid: (value: number) => boolean
  // Resolves false when the write failed — that is what decides whether a one-shot input clears.
  onApply: (value: number) => Promise<boolean> | void
  // The percent tool stamps and forgets, so its input empties; the kwota keeps showing what is stored.
  clearOnApply?: boolean
  // Takes the value about to be written and returns what the confirm dialog should say. Present only
  // for a write that cannot be taken back — the kwota is undoable and asks nothing.
  confirm?: (value: number) => { title: ReactNode; description?: ReactNode; confirmLabel?: string }
}

// Both rabat-globalny modes commit the same way: type, then press „Zapisz" (or Enter). Nothing is
// written on blur — a rabat is a deal-level concession, so leaving the field must never be enough to
// change it, and the two modes must not disagree about what counts as confirming a value.
//
// Not DecimalField despite the matching look: the percent mode needs a confirm dialog over a write it
// cannot undo, and an input that empties once the write lands. Neither belongs in the field every
// plain number in the app uses.
export function DiscountValueField({
  label,
  suffix,
  value,
  placeholder,
  disabled = false,
  isValid,
  onApply,
  clearOnApply = false,
  confirm,
}: PropsT) {
  const [raw, setRaw] = useState(value)
  const [pending, setPending] = useState(false)
  // The value waiting on the dialog. Held rather than re-read at confirm time so the dialog's text
  // and the write can never describe two different numbers.
  const [confirming, setConfirming] = useState<number | null>(null)

  // Undo, a failed save rolling back, or a mode switch reseeding the kwota all move the stored figure
  // without touching this input — resync so the field never shows a value that is no longer stored.
  const [seenValue, setSeenValue] = useState(value)
  if (seenValue !== value) {
    setSeenValue(value)
    setRaw(value)
  }

  const parsed = parseDecimalInput(raw)
  const parsedValue = parsed.kind === 'value' ? parsed.value : null
  // `raw !== value` keeps „Zapisz" inert until something actually changed, so the button doubles as
  // the answer to „did my edit go through".
  const canApply = parsedValue != null && isValid(parsedValue) && raw !== value

  function requestApply() {
    if (!canApply || pending || parsedValue == null) return
    if (confirm) setConfirming(parsedValue)
    else void write(parsedValue)
  }

  async function write(next: number) {
    setConfirming(null)
    setPending(true)
    const ok = await onApply(next)
    setPending(false)
    if (ok !== false && clearOnApply) setRaw('')
  }

  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      {label}
      <DecimalInput
        value={raw}
        placeholder={placeholder}
        disabled={disabled || pending}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') requestApply()
        }}
        // Borrows the „Zapisz" radius beside it — the pair reads as one control, not a field and a button.
        className="text-chart-green rounded-md"
      />
      {suffix}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={disabled || !canApply || pending}
        onClick={requestApply}
      >
        Zapisz
      </Button>
      {confirm != null && confirming != null && (
        <ConfirmDialog
          open
          {...confirm(confirming)}
          pending={pending}
          pendingLabel="Zapisywanie…"
          onConfirm={() => void write(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </label>
  )
}
