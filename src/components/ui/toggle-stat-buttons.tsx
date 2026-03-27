'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { FilterGrid } from '@/components/ui/filter-grid'
import { Description } from '@/components/ui/description'
import { SaldoDisplay, saldoColor } from '@/components/ui/saldo-display'

type StatEntryT = {
  label: string
  value: string
  amount: number
  borderClassName: string
}

type ToggleStatButtonsPropsT = {
  rows: StatEntryT[][]
  rowLabels?: string[]
  summaryLabel: string
  helpText?: string
  colorValues?: boolean
  onToggle?: (label: string) => void
}

export function computeSummary(entries: readonly StatEntryT[], hidden: Set<string>): number {
  return entries.filter((e) => !hidden.has(e.label)).reduce((sum, e) => sum + e.amount, 0)
}

export function ToggleStatButtons({
  rows,
  rowLabels,
  summaryLabel,
  helpText,
  colorValues,
  onToggle,
}: ToggleStatButtonsPropsT) {
  const allEntries = rows.flat()

  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  function toggle(label: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
    onToggle?.(label)
  }

  if (allEntries.length === 0) return null

  const total = computeSummary(allEntries, hidden)

  return (
    <div className="mb-4 space-y-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex}>
          {rowLabels?.[rowIndex] && <Description>{rowLabels[rowIndex]}</Description>}
          <FilterGrid className="mt-2">
            {row.map((entry) => {
              const isHidden = hidden.has(entry.label)
              return (
                <Button
                  variant="outline"
                  key={entry.label}
                  onClick={() => toggle(entry.label)}
                  className={cn(
                    'justify-start border-2',
                    entry.borderClassName,
                    isHidden && 'opacity-40',
                  )}
                >
                  <span className="text-muted-foreground">{entry.label}:</span>
                  <span className={cn('font-medium', colorValues && saldoColor(entry.amount))}>
                    {entry.value}
                  </span>
                </Button>
              )
            })}
          </FilterGrid>
        </div>
      ))}

      {helpText && <Description>{helpText}</Description>}

      <SaldoDisplay
        saldo={total}
        label={summaryLabel}
        selectionCount={{ selected: allEntries.length - hidden.size, total: allEntries.length }}
      />
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
