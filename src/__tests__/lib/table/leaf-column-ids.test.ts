import { describe, it, expect } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { leafColumnIds } from '@/lib/table/leaf-column-ids'
import { baseRanksFromKeys, orderColumnKeys, rankForMove } from '@/lib/table/column-order'

type RowT = { id: number; date: string; amount: number; worker: string }

const COLUMNS: ColumnDef<RowT, unknown>[] = [
  { id: 'id', accessorKey: 'id' },
  { accessorKey: 'date' },
  { accessorKey: 'amount' },
  { id: 'worker', accessorFn: (row) => row.worker },
]

describe('leafColumnIds', () => {
  it('reads the declared order, taking accessorKey when no id is given', () => {
    expect(leafColumnIds(COLUMNS)).toEqual(['id', 'date', 'amount', 'worker'])
  })

  it('yields an empty id for a def with neither id nor accessorKey', () => {
    expect(leafColumnIds([{ header: 'Akcje' }] as ColumnDef<RowT, unknown>[])).toEqual([''])
  })
})

describe('base ranks under a stored rank', () => {
  it('does not move when a column has already been dragged', () => {
    const declared = leafColumnIds(COLUMNS)
    const base = baseRanksFromKeys(declared)
    const ranks = { worker: -1 }

    expect(orderColumnKeys(declared, ranks)).toEqual(['worker', 'id', 'date', 'amount'])
    expect(baseRanksFromKeys(leafColumnIds(COLUMNS))).toEqual(base)
  })

  it('lands a second drop where it was dropped', () => {
    const declared = leafColumnIds(COLUMNS)
    const base = baseRanksFromKeys(declared)

    const first = { worker: rankForMove(declared, 'worker', 0, {}, base) }
    const ordered = orderColumnKeys(declared, first)
    expect(ordered).toEqual(['worker', 'id', 'date', 'amount'])

    const second = { ...first, amount: rankForMove(ordered, 'amount', 1, first, base) }
    expect(orderColumnKeys(declared, second)).toEqual(['worker', 'amount', 'id', 'date'])
  })

  it('lands it one slot off when the base ranks are read off the ordered list', () => {
    const declared = leafColumnIds(COLUMNS)
    const base = baseRanksFromKeys(declared)
    const first = { worker: rankForMove(declared, 'worker', 0, {}, base) }
    const ordered = orderColumnKeys(declared, first)

    const staleBase = baseRanksFromKeys(ordered)
    const second = { ...first, amount: rankForMove(ordered, 'amount', 1, first, staleBase) }
    expect(orderColumnKeys(declared, second)).not.toEqual(['worker', 'amount', 'id', 'date'])
  })
})
