'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  getExpenseDuplicateColumns,
  type ExpenseDuplicateRowT,
} from '@/components/tables/expense-duplicates'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { isWeakMatch } from '@/lib/expense-duplicates/match'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'
import { cn } from '@/lib/utils/cn'

export type DuplicateHintsStateT =
  | { status: 'reading' }
  | { status: 'checking' }
  | { status: 'no-read' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; paragons: ParagonDuplicatesT[] }

type PropsT = {
  state: DuplicateHintsStateT
  // Numbers each hint by its row's position in the form.
  lineItemIds: string[]
  // Resolved at render: a merge or split moves a paragon to another row.
  itemIdOfReadRow: (readRow: number) => string | undefined
  onMarkDuplicate: (itemId: string, duplicateOf: DuplicateOfT) => void
}

// By read row, not by item: a merge or split mints new item ids under the same paragon.
const rowKey = (row: ExpenseDuplicateRowT) => `${row.paragonReadRow}-${row.key}`

const STATUS_MESSAGES = {
  reading: 'Odczytywanie paragonów — duplikaty sprawdzimy po odczycie.',
  checking: 'Sprawdzanie duplikatów…',
  'no-read': 'Bez odczytu paragonów nie da się sprawdzić duplikatów.',
} as const

export function ExpenseDraftDuplicateHints({
  state,
  lineItemIds,
  itemIdOfReadRow,
  onMarkDuplicate,
}: PropsT) {
  // „OK" only hides the row for this dialog; nothing is stored.
  const [dismissed, setDismissed] = useState(() => new Set<string>())

  if (state.status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-destructive text-sm">Nie udało się sprawdzić duplikatów.</p>
        <Button type="button" variant="outline" size="sm" onClick={state.retry}>
          Sprawdź ponownie
        </Button>
      </div>
    )
  }
  if (state.status !== 'ready') {
    return <p className="text-muted-foreground text-sm">{STATUS_MESSAGES[state.status]}</p>
  }
  // A paragon removed or marked a duplicate resolves to no row and takes its hints with it.
  const rows = state.paragons
    .flatMap((paragon) => {
      const itemId = itemIdOfReadRow(paragon.readRow)
      if (!itemId) return []
      const label = [lineItemIds.indexOf(itemId) + 1, paragon.description]
        .filter(Boolean)
        .join(' · ')
      return paragon.matches.map(
        (match): ExpenseDuplicateRowT => ({
          ...match,
          paragon: label,
          paragonItemId: itemId,
          paragonReadRow: paragon.readRow,
        }),
      )
    })
    .filter((row) => !dismissed.has(rowKey(row)))
  if (rows.length === 0) {
    return null
  }

  // Only a confirmed match earns the alarm; „Ta sama kwota" alone stays as quiet as its row.
  const isAlarm = rows.some((row) => !isWeakMatch(row.reasons))

  return (
    <section
      className={cn(
        'my-4 flex flex-col gap-3 rounded-lg border-2 p-4',
        isAlarm ? 'border-destructive' : 'border-border',
      )}
    >
      <h3 className={cn('font-medium', isAlarm && 'text-destructive')}>Możliwe duplikaty</h3>
      <DataTable
        data={rows}
        columns={getExpenseDuplicateColumns<ExpenseDuplicateRowT>({
          showParagon: lineItemIds.length > 1,
          actions: (row) => (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setDismissed((prev) => new Set(prev).add(rowKey(row)))}
              >
                OK, to nie duplikat
              </Button>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                onClick={() =>
                  onMarkDuplicate(row.paragonItemId, { source: row.source, id: row.id })
                }
              >
                Duplikat
              </Button>
            </div>
          ),
        })}
      />
    </section>
  )
}
