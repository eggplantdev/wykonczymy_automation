'use client'

// SPIKE (EX-1025): management-only hint in the accept dialog of a zgłoszenie.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  getExpenseDuplicateColumns,
  type ExpenseDuplicateRowT,
} from '@/components/tables/expense-duplicates'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'

type PropsT = {
  paragons: ParagonDuplicatesT[] | undefined
  onMarkDuplicate: (row: ExpenseDuplicateRowT) => Promise<void>
}

const rowKey = (row: ExpenseDuplicateRowT) => `${row.paragonRowIndex}-${row.source}-${row.id}`

export function ExpenseDraftDuplicateHints({ paragons, onMarkDuplicate }: PropsT) {
  // SPIKE: „OK" only hides the row for this dialog; nothing is stored yet.
  const [dismissed, setDismissed] = useState(() => new Set<string>())
  const [markingKey, setMarkingKey] = useState<string | undefined>()

  if (!paragons) {
    return <p className="text-muted-foreground text-sm">Sprawdzanie duplikatów…</p>
  }
  const rows = paragons
    .flatMap((paragon) =>
      paragon.matches.map(
        (match): ExpenseDuplicateRowT => ({
          ...match,
          paragon: [paragon.rowIndex + 1, paragon.description].filter(Boolean).join(' · '),
          paragonRowIndex: paragon.rowIndex,
          paragonMediaIds: paragon.mediaIds,
        }),
      ),
    )
    .filter((row) => !dismissed.has(rowKey(row)))
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Nie znaleziono podobnych wydatków.</p>
  }

  async function markDuplicate(row: ExpenseDuplicateRowT) {
    setMarkingKey(rowKey(row))
    try {
      await onMarkDuplicate(row)
    } finally {
      setMarkingKey(undefined)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">Możliwe duplikaty</h3>
      <DataTable
        data={rows}
        columns={getExpenseDuplicateColumns({
          showParagon: paragons.length > 1,
          actions: (row) => (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={markingKey !== undefined}
                onClick={() => setDismissed((prev) => new Set(prev).add(rowKey(row)))}
              >
                OK, to nie duplikat
              </Button>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                disabled={markingKey !== undefined}
                onClick={() => markDuplicate(row)}
              >
                {markingKey === rowKey(row) ? 'Odrzucanie…' : 'Duplikat'}
              </Button>
            </div>
          ),
        })}
      />
    </section>
  )
}
