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
  readonly valueClassName?: string
  readonly pairedWith?: string
  readonly defaultHidden?: boolean
}

type ToggleStatButtonsPropsT = {
  readonly rows: readonly (readonly StatEntryT[])[]
  readonly rowLabels?: readonly string[]
  readonly summaryLabel: string
  readonly helpText?: string
  readonly showSelectionCount?: boolean
  readonly onToggle?: (label: string) => void
}

export function buildToggleResult(
  label: string,
  prev: ReadonlySet<string>,
  pairedWith: string | undefined,
): Set<string> {
  const next = new Set(prev)

  if (pairedWith) {
    // Paired toggle: if clicking a hidden card, show it and hide its pair
    if (next.has(label)) {
      next.delete(label)
      next.add(pairedWith)
    }
    // If clicking a visible paired card, no-op
    return next
  }

  // Non-paired: normal toggle
  if (next.has(label)) next.delete(label)
  else next.add(label)
  return next
}

export function computeSummary(
  entries: readonly StatEntryT[],
  hidden: ReadonlySet<string>,
): number {
  return entries.filter((e) => !hidden.has(e.label)).reduce((sum, e) => sum + e.amount, 0)
}

export function ToggleStatButtons({
  rows,
  rowLabels,
  summaryLabel,
  helpText,
  showSelectionCount,
  onToggle,
}: ToggleStatButtonsPropsT) {
  const allEntries = rows.flat()

  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(allEntries.filter((e) => e.defaultHidden).map((e) => e.label)),
  )

  function toggle(label: string) {
    const entry = allEntries.find((e) => e.label === label)
    setHidden((prev) => buildToggleResult(label, prev, entry?.pairedWith))

    // Fire onToggle for both cards in a paired swap to keep Zustand store in sync
    onToggle?.(label)
    if (entry?.pairedWith) onToggle?.(entry.pairedWith)
  }

  if (allEntries.length === 0) return null

  const total = computeSummary(allEntries, hidden)

  return (
    <div className="mb-4 space-y-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex}>
          {rowLabels?.[rowIndex] && <Description>{rowLabels[rowIndex]}</Description>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {row.map((entry) => {
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
                  <span className={cn('font-medium', entry.valueClassName)}>{entry.value}</span>
                </Button>
              )
            })}
          </div>
        </div>
      ))}

      {helpText && <Description>{helpText}</Description>}

      <SaldoDisplay
        saldo={total}
        label={summaryLabel}
        selectionCount={
          showSelectionCount
            ? { selected: allEntries.length - hidden.size, total: allEntries.length }
            : undefined
        }
      />
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
