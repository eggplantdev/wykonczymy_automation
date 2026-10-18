import { describe, it, expect } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { leafColumnIds } from '@/lib/table/leaf-column-ids'

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
