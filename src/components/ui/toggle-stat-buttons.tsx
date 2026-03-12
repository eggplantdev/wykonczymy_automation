'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { SaldoDisplay } from '@/components/ui/saldo-display'

type StatEntryT = {
  readonly label: string
  readonly value: string
  readonly amount: number
  readonly borderColor: string
}

type ToggleStatButtonsPropsT = {
  readonly entries: readonly StatEntryT[]
  readonly summaryLabel: string
  readonly helpText?: string
  readonly onToggle?: (label: string) => void
}

export function computeSummary(
  entries: readonly StatEntryT[],
  hidden: ReadonlySet<string>,
): number {
  return entries.filter((e) => !hidden.has(e.label)).reduce((sum, e) => sum + e.amount, 0)
}

export function ToggleStatButtons({
  entries,
  summaryLabel,
  helpText,
  onToggle,
}: ToggleStatButtonsPropsT) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  function toggle(label: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
    onToggle?.(label)
  }

  if (entries.length === 0) return null

  const total = computeSummary(entries, hidden)

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {entries.map((entry) => {
          const isHidden = hidden.has(entry.label)
          return (
            <Button
              variant="outline"
              key={entry.label}
              onClick={() => toggle(entry.label)}
              className={cn('border-2', isHidden && 'opacity-40')}
              style={{ borderColor: entry.borderColor }}
              aria-pressed={!isHidden}
              aria-label={`${isHidden ? 'Pokaż' : 'Ukryj'} ${entry.label}`}
            >
              <span className="text-muted-foreground">{entry.label}:</span>
              <span className="font-medium">{entry.value}</span>
            </Button>
          )
        })}
      </div>

      {helpText && <Description>{helpText}</Description>}

      <SaldoDisplay saldo={total} label={summaryLabel} />
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
