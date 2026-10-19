import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useActiveFilter } from '@/hooks/use-active-filter'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'

type RowT = { id: number; status: string; active: boolean }

const rows: RowT[] = [
  { id: 1, status: 'draft', active: true },
  { id: 2, status: 'sent', active: false },
  { id: 3, status: 'draft', active: false },
]

const ids = (list: RowT[]) => list.map((row) => row.id)

describe('useClientMultiFilter', () => {
  it('shows every row while nothing is picked', () => {
    const { result } = renderHook(() => useClientMultiFilter(rows, (row) => row.status))
    expect(ids(result.current.filteredData)).toEqual([1, 2, 3])
  })

  it('narrows to the picked values and follows later picks', () => {
    const { result } = renderHook(() => useClientMultiFilter(rows, (row) => row.status, ['draft']))
    expect(ids(result.current.filteredData)).toEqual([1, 3])

    act(() => result.current.setValues(['sent']))
    expect(ids(result.current.filteredData)).toEqual([2])
  })

  it('re-filters when the rows change', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useClientMultiFilter(data, (row) => row.status, ['draft']),
      { initialProps: { data: rows } },
    )
    rerender({ data: [...rows, { id: 4, status: 'draft', active: true }] })
    expect(ids(result.current.filteredData)).toEqual([1, 3, 4])
  })
})

describe('useActiveFilter', () => {
  it('starts on active rows only and can show all', () => {
    const { result } = renderHook(() => useActiveFilter(rows, (row) => row.active))
    expect(ids(result.current.filteredData)).toEqual([1])

    act(() => result.current.setShowOnlyActive(false))
    expect(ids(result.current.filteredData)).toEqual([1, 2, 3])
  })
})
