'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  getExpenseDuplicateColumns,
  type ExpenseDuplicateRowT,
} from '@/components/tables/expense-duplicates'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'

export type ItemDuplicatesT = ParagonDuplicatesT & { itemId: string }

export type DuplicateHintsStateT =
  | { status: 'reading' }
  | { status: 'checking' }
  | { status: 'no-read' }
  | { status: 'error'; message: string }
  | { status: 'ready'; paragons: ItemDuplicatesT[] }

type PropsT = {
  state: DuplicateHintsStateT
  // The form's current rows: a paragon removed or marked a duplicate takes its hints with it.
  lineItemIds: string[]
  onMarkDuplicate: (itemId: string, duplicateOf: DuplicateOfT) => void
}

const rowKey = (row: ExpenseDuplicateRowT) => `${row.paragonItemId}-${row.key}`

const STATUS_MESSAGES = {
  reading: 'Odczytywanie paragonów — duplikaty sprawdzimy po odczycie.',
  checking: 'Sprawdzanie duplikatów…',
  'no-read': 'Bez odczytu paragonów nie da się sprawdzić duplikatów.',
} as const

export function ExpenseDraftDuplicateHints({ state, lineItemIds, onMarkDuplicate }: PropsT) {
  // „OK" only hides the row for this dialog; nothing is stored.
  const [dismissed, setDismissed] = useState(() => new Set<string>())

  if (state.status === 'error') {
    return <p className="text-destructive text-sm">{state.message}</p>
  }
  if (state.status !== 'ready') {
    return <p className="text-muted-foreground text-sm">{STATUS_MESSAGES[state.status]}</p>
  }
  const rows = state.paragons
    .filter((paragon) => lineItemIds.includes(paragon.itemId))
    .flatMap((paragon) =>
      paragon.matches.map(
        (match): ExpenseDuplicateRowT => ({
          ...match,
          paragon: [lineItemIds.indexOf(paragon.itemId) + 1, paragon.description]
            .filter(Boolean)
            .join(' · '),
          paragonItemId: paragon.itemId,
        }),
      ),
    )
    .filter((row) => !dismissed.has(rowKey(row)))
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Nie znaleziono podobnych wydatków.</p>
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">Możliwe duplikaty</h3>
      <DataTable
        data={rows}
        columns={getExpenseDuplicateColumns({
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
