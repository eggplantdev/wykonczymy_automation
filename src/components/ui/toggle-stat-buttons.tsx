'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { Button } from '@/components/ui/button'
import { ControlGrid } from '@/components/ui/control-grid'
import { Description } from '@/components/ui/description'
import { SignedMoneyDisplay, signedMoneyColor } from '@/components/ui/signed-money-display'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type StatEntryT = {
  label: string
  value: string
  amount: number
  borderClassName: string
  tooltip?: string
}

type ToggleStatButtonsPropsT = {
  rows: StatEntryT[][]
  rowLabels?: string[]
  rowTooltips?: (string | undefined)[]
  summaryLabel: string
  summaryTooltip?: string
  helpText?: string
  colorValues?: boolean
}

export function computeSummary(
  entries: readonly { label: string; amount: number }[],
  hidden: Set<string>,
): number {
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
}: ToggleStatButtonsPropsT) {
  const allEntries = rows.flat()

  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  function toggle(label: string) {
    setHidden((prev) => toggleInSet(prev, label))
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
            {/* A tile's content is a label plus a money figure and `Button` is `whitespace-nowrap`,
                so its min-content width is the whole string — in a half-width cell it cannot shrink
                and spills out of the grid. */}
            <ControlGrid className="mt-2 max-sm:grid-cols-1">
              {row.map((entry) => {
                const isHidden = hidden.has(entry.label)
                const button = (
                  <Button
                    variant="outline"
                    key={entry.label}
                    onClick={() => toggle(entry.label)}
                    align="start"
                    className={cn('border-2', entry.borderClassName, isHidden && 'opacity-40')}
                  >
                    <span className="text-muted-foreground">{entry.label}:</span>
                    <span
                      className={cn('font-medium', colorValues && signedMoneyColor(entry.amount))}
                    >
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
            </ControlGrid>
          </div>
        )
      })}

      <SignedMoneyDisplay
        amount={total}
        label={summaryLabel}
        tooltip={summaryTooltip}
        selectionCount={{ selected: allEntries.length - hidden.size, total: allEntries.length }}
      />

      {helpText && <Description>{helpText}</Description>}
    </div>
  )
}

export type { StatEntryT }
