'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { FilterGrid } from '@/components/ui/filter-grid'
import { Description } from '@/components/ui/description'
import { SaldoDisplay, saldoColor } from '@/components/ui/saldo-display'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type StatEntryT = {
  label: string
  value: string
  amount: number
  borderClassName: string
  // Explanation shown via an (i) rendered beside the tile (can't nest inside — the tile is a button).
  tooltip?: string
}

type ToggleStatButtonsPropsT = {
  rows: StatEntryT[][]
  rowLabels?: string[]
  // Per-row (i) explanation, parallel to rowLabels.
  rowTooltips?: (string | undefined)[]
  summaryLabel: string
  summaryTooltip?: string
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
  rowTooltips,
  summaryLabel,
  summaryTooltip,
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
    <div className="space-y-2">
      {rows.map((row, rowIndex) => {
        const rowLabel = rowLabels?.[rowIndex]
        const rowTooltip = rowTooltips?.[rowIndex]
        return (
          <div key={rowIndex}>
            {rowLabel && (
              <Description>
                {rowLabel}
                {rowTooltip && (
                  <InfoTooltip
                    content={rowTooltip}
                    label={`Co to jest: ${rowLabel}`}
                    className="ml-1"
                  />
                )}
              </Description>
            )}
            <FilterGrid className="mt-2">
              {row.map((entry) => {
                const isHidden = hidden.has(entry.label)
                const button = (
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
                return entry.tooltip ? (
                  <span key={entry.label} className="inline-flex items-center">
                    {button}
                    <InfoTooltip
                      content={entry.tooltip}
                      label={`Co to jest: ${entry.label}`}
                      className="ml-1"
                    />
                  </span>
                ) : (
                  button
                )
              })}
            </FilterGrid>
          </div>
        )
      })}

      <SaldoDisplay
        saldo={total}
        label={summaryLabel}
        tooltip={summaryTooltip}
        selectionCount={{ selected: allEntries.length - hidden.size, total: allEntries.length }}
      />

      {helpText && <Description>{helpText}</Description>}
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
