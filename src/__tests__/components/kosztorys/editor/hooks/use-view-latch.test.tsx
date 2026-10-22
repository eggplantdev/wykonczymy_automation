import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useViewLatch } from '@/components/kosztorys/editor/hooks/use-view-latch'
import type { SortStateT } from '@/lib/kosztorys/row-view'

type InputT = Parameters<typeof useViewLatch>[0]

const IDLE: InputT = { conditionIds: new Set(), search: '', sort: null, view: 'client' }
const SORT: SortStateT = { field: 'plannedQty', dir: 'asc', scope: 'section' }

function renderLatch(initial: InputT) {
  return renderHook((input: InputT) => useViewLatch(input), { initialProps: initial })
}

describe('useViewLatch', () => {
  it('holds nothing while no sort, search or latching condition is active', () => {
    expect(renderLatch(IDLE).result.current.latch).toBeNull()
  })

  it('keeps the latch while its inputs stay the same', () => {
    const { result, rerender } = renderLatch({ ...IDLE, sort: SORT })
    result.current.latch?.ids.add(1)

    rerender({ ...IDLE, sort: SORT, search: '  ' })

    expect(result.current.latch?.ids.has(1)).toBe(true)
  })

  // Picking the active sort item again is the re-sort gesture.
  it('resets on a fresh sort object even with the same field, direction and scope', () => {
    const { result, rerender } = renderLatch({ ...IDLE, sort: SORT })
    result.current.latch?.ids.add(1)

    rerender({ ...IDLE, sort: { ...SORT } })

    expect(result.current.latch?.ids.size).toBe(0)
  })

  it('resets when the search phrase changes', () => {
    const { result, rerender } = renderLatch({ ...IDLE, search: 'płyt' })
    result.current.latch?.ids.add(1)

    rerender({ ...IDLE, search: 'płyta' })

    expect(result.current.latch?.ids.size).toBe(0)
  })
})
