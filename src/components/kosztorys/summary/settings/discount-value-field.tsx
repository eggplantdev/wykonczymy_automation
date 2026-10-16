'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DecimalInput } from '@/components/ui/decimal-input'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  suffix?: ReactNode
  placeholder?: string
  disabled?: boolean
  isValid: (value: number) => boolean
  onApply: (value: number) => Promise<boolean>
  confirm?: (value: number) => { title: ReactNode; description?: ReactNode; confirmLabel?: string }
}

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
  // Held rather than re-read at confirm time so the dialog's text and the write can never describe
  // two different numbers.
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
