'use client'

import type { ReactNode } from 'react'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type PropsT = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  description?: ReactNode
  disabled?: boolean
  lockedReason?: string
}

export function InlineModeSelect({
  label,
  value,
  onValueChange,
  options,
  description,
  disabled = false,
  lockedReason,
}: PropsT) {
  const hint = lockedReason ?? description
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <SimpleSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        disabled={disabled || lockedReason !== undefined}
        variant="toolbarSm"
      />
      {hint && <InfoTooltip content={hint} label={`Więcej o: ${label}`} />}
    </div>
  )
}
