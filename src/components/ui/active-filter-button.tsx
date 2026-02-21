'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ActiveFilterButtonPropsT = {
  readonly isActive: boolean
  readonly onChange: (value: boolean) => void
  readonly activeLabel: string
  readonly allLabel: string
}

export function ActiveFilterButton({
  isActive,
  onChange,
  activeLabel,
  allLabel,
}: ActiveFilterButtonPropsT) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={
        isActive
          ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
          : undefined
      }
      onClick={() => onChange(!isActive)}
    >
      {isActive && <Check className="size-3.5" />}
      {isActive ? activeLabel : allLabel}
    </Button>
  )
}
