'use client'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  getExpenseDuplicateColumns,
  type ExpenseDuplicateRowT,
} from '@/components/tables/expense-duplicates'
import type { ParagonRowT } from '@/components/forms/expense-form/expense-form'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { isWeakMatch } from '@/lib/expense-duplicates/match'
import type { DuplicateMatchT } from '@/lib/expense-duplicates/types'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'
import { cn } from '@/lib/utils/cn'
import { formatPLNOrDash } from '@/lib/utils/format-currency'

type PropsT = {
  paragons: ParagonDuplicatesT[]
  draftId: number
  itemId: string
  // Resolved at render: a merge or split moves a paragon to another row.
  paragonOfReadRow: (readRow: number) => ParagonRowT | undefined
  onMarkDuplicate: (itemId: string, duplicateOf: DuplicateOfT) => void
  // „OK" only hides the match for this dialog; nothing is stored.
  dismissed: ReadonlySet<string>
  onDismiss: (key: string) => void
  disabled: boolean
  renderRow: (hint: React.ReactNode) => React.ReactNode
}

// By read row, not by item: a merge or split mints new item ids under the same paragon.
const rowKey = (row: ExpenseDuplicateRowT) => `${row.paragonReadRow}-${row.key}`

export function ExpenseDraftDuplicateHints({
  paragons,
  draftId,
  itemId,
  paragonOfReadRow,
  onMarkDuplicate,
  dismissed,
  onDismiss,
  disabled,
  renderRow,
}: PropsT) {
  const twinOf = (match: DuplicateMatchT) =>
    match.source === 'draft' && match.id === draftId
      ? match.readRows.map(paragonOfReadRow).find((row) => row !== undefined)
      : undefined

  // A decided paragon takes its hints with it.
  const ownParagons = paragons.filter((paragon) => {
    const row = paragonOfReadRow(paragon.readRow)
    return row?.itemId === itemId && row.status === 'pending'
  })
  const groups = ownParagons.flatMap((paragon) => {
    const rows = paragon.matches
      .map(
        (match): ExpenseDuplicateRowT => ({
          ...match,
          paragonItemId: itemId,
          paragonReadRow: paragon.readRow,
        }),
      )
      // A refused twin is no longer a second booking of this paragon; an accepted one still is. A
      // twin merged into this very row was declared the same expense by the merge.
      .filter((row) => {
        const twin = twinOf(row)
        return !dismissed.has(rowKey(row)) && twin?.status !== 'rejected' && twin?.itemId !== itemId
      })
    if (rows.length === 0) return []
    // The row's own title names a lone paragon; a merged row needs each of its paragony named.
    const label =
      ownParagons.length > 1
        ? [paragon.description, paragon.amount !== null && formatPLNOrDash(paragon.amount)]
            .filter(Boolean)
            .join(' · ')
        : null
    return [{ readRow: paragon.readRow, label, rows }]
  })
  const hasHints = groups.length > 0
  // Only a confirmed match earns the alarm; „Ta sama kwota" alone stays as quiet as its row.
  const isAlarm = groups.some((group) => group.rows.some((row) => !isWeakMatch(row.reasons)))

  const columns = getExpenseDuplicateColumns<ExpenseDuplicateRowT>({
    labelMatch: (row) => {
      const twin = twinOf(row)
      return twin && `Pozycja ${twin.position + 1} tego zgłoszenia`
    },
    actions: (row) => (
      <div className="flex gap-2">
        <Button type="button" size="xs" variant="outline" onClick={() => onDismiss(rowKey(row))}>
          OK, to nie duplikat
        </Button>
        <Button
          type="button"
          size="xs"
          variant="destructive"
          disabled={disabled}
          onClick={() => onMarkDuplicate(row.paragonItemId, { source: row.source, id: row.id })}
        >
          Duplikat
        </Button>
      </div>
    ),
  })

  // The frame stays mounted when the last match goes, or the row inside it would remount.
  return (
    <div
      className={cn(
        hasHints && 'rounded-lg border-2 p-3',
        hasHints && (isAlarm ? 'border-destructive' : 'border-border'),
      )}
    >
      {renderRow(
        hasHints && (
          <section className="flex flex-col gap-1.5 pb-3">
            <h3 className={cn('text-sm font-medium', isAlarm && 'text-destructive')}>
              Możliwe duplikaty
            </h3>
            {groups.map((group) => (
              <div key={group.readRow} className="flex flex-col gap-1">
                {group.label && <h4 className="text-xs font-medium">Paragon: {group.label}</h4>}
                <DataTable data={group.rows} columns={columns} defaultTextSize="xs" />
              </div>
            ))}
          </section>
        ),
      )}
    </div>
  )
}
