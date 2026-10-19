import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useEngagedIds } from '@/hooks/use-engaged-ids'

let keySeq = 0
const freshKey = () => `engaged-test-${++keySeq}`

afterEach(() => {
  window.localStorage.clear()
})

describe('useEngagedIds', () => {
  it('toggles an id on and off', () => {
    const key = freshKey()
    const { result } = renderHook(() => useEngagedIds(key))

    act(() => result.current.toggle('a'))
    expect([...result.current.engagedIds]).toEqual(['a'])

    act(() => result.current.toggle('a'))
    expect(result.current.engagedIds.size).toBe(0)
  })

  it('keeps one id per exclusive group without touching ids outside it', () => {
    const key = freshKey()
    const { result } = renderHook(() => useEngagedIds(key))

    act(() => result.current.toggle('filter'))
    act(() => result.current.toggleExclusive('p1', ['p1', 'p2']))
    act(() => result.current.toggleExclusive('p2', ['p1', 'p2']))

    expect([...result.current.engagedIds].sort()).toEqual(['filter', 'p2'])
  })

  it('shares state between two readers of the same key', () => {
    const key = freshKey()
    const first = renderHook(() => useEngagedIds(key))
    const second = renderHook(() => useEngagedIds(key))

    act(() => first.result.current.setMany(['x', 'y'], true))
    expect([...second.result.current.engagedIds].sort()).toEqual(['x', 'y'])

    act(() => second.result.current.clear())
    expect(first.result.current.engagedIds.size).toBe(0)
  })
})
