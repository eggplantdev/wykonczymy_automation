'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DecimalInput } from '@/components/ui/decimal-input'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  // Unit printed after the input, BEFORE „Zapisz" — same order as DecimalField, so the two kinds of
  // number field in the settings popover read as one control rather than two near-misses.
  suffix?: ReactNode
  placeholder?: string
  disabled?: boolean
  isValid: (value: number) => boolean
  // Resolves false when the write failed — a failed stamp keeps the typed value for a retry.
  onApply: (value: number) => Promise<boolean>
  // Takes the value about to be written and returns what the confirm dialog should say. Absent when
  // the write destroys nothing.
  confirm?: (value: number) => { title: ReactNode; description?: ReactNode; confirmLabel?: string }
}

// The percent rabat: a one-shot stamp into every pozycja, so it stores nothing and its input empties
// once the write lands. Commits through „Zapisz" or Enter, never on blur — same as the kwota pair.
//
// Not DecimalField despite the matching look: the stamp needs a confirm dialog over a write it
// cannot undo, and an input that empties once the write lands. Neither belongs in the field every
// plain number in the app uses.
export function DiscountValueField({
  suffix,
  placeholder,
  disabled = false,
  isValid,
  onApply,
  confirm,
}: PropsT) {
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)
  // The value waiting on the dialog. Held rather than re-read at confirm time so the dialog's text
  // and the write can never describe two different numbers.
  const [confirming, setConfirming] = useState<number | null>(null)

  const parsed = parseDecimalInput(raw)
  const parsedValue = parsed.kind === 'value' ? parsed.value : null
  const canApply = parsedValue != null && isValid(parsedValue)

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
    if (ok) setRaw('')
  }

  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
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
          onConfirm={() => void write(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </label>
  )
}
