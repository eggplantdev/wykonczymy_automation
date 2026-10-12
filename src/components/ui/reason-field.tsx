'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type PropsT = {
  id: string
  value: string
  onChange: (value: string) => void
  min: number
  max: number
  label: string
  placeholder: string
  // `missing` is 0 once the trimmed text reaches `min`. The caller words it, so the field speaks the
  // viewer's language without knowing there is one.
  counterText: (counts: { length: number; missing: number }) => string
  disabled?: boolean
}

export function ReasonField({
  id,
  value,
  onChange,
  min,
  max,
  label,
  placeholder,
  counterText,
  disabled,
}: PropsT) {
  const length = value.trim().length
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
        autoFocus
      />
      <p className="text-muted-foreground text-xs">
        {counterText({ length, missing: Math.max(0, min - length) })}
      </p>
    </div>
  )
}
