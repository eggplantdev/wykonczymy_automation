'use client'

import { useState } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'

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

export function valueColor(value: number): string {
  return value >= 0 ? 'var(--color-chart-green)' : 'var(--color-destructive)'
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

  const total = computeSummary(entries, hidden)

  if (entries.length === 0) return null

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
              <span className="font-medium" style={{ color: valueColor(entry.amount) }}>
                {entry.value}
              </span>
            </Button>
          )
        })}
      </div>

      {helpText && <Description>{helpText}</Description>}

      <Description>
        <span>{summaryLabel}: </span>
        <span className={cn('font-semibold', total >= 0 ? 'text-chart-green' : 'text-destructive')}>
          {formatPLN(total)}
        </span>
      </Description>
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
