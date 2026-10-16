import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'

// The hook caches one store per investment at MODULE scope, and clearing localStorage does not clear
// that cache — so every test takes an id of its own rather than resetting between them.
let nextInvestmentId = 9000
function freshEditor() {
  const investmentId = ++nextInvestmentId
  return renderHook(() => useEngagedConditions(investmentId))
}

describe('useEngagedConditions — setMany', () => {
  it('engages a whole list in one pass', () => {
    const { result } = freshEditor()

    act(() => result.current.setMany(['has-note', 'no-note'], true))

    expect([...result.current.engagedIds]).toEqual(['has-note', 'no-note'])
  })

  it('drops the ids it is given and leaves the rest engaged', () => {
    const { result } = freshEditor()

    act(() => result.current.setMany(['has-note', 'no-note'], true))
    act(() => result.current.setMany(['has-note'], false))

    expect([...result.current.engagedIds]).toEqual(['no-note'])
  })

  it('keeps the same set when every id already stands where it is put', () => {
    const { result } = freshEditor()

    act(() => result.current.setMany(['has-note'], true))
    const before = result.current.engagedIds
    const writes = vi.spyOn(Storage.prototype, 'setItem')

    act(() => result.current.setMany(['has-note'], true))

    expect(result.current.engagedIds).toBe(before)
    expect(writes).not.toHaveBeenCalled()
    writes.mockRestore()
  })

  it('writes nothing when asked to disengage ids that were never engaged', () => {
    const { result } = freshEditor()
    const before = result.current.engagedIds
    const writes = vi.spyOn(Storage.prototype, 'setItem')

    act(() => result.current.setMany(['has-note', 'no-note'], false))

    expect(result.current.engagedIds).toBe(before)
    expect(writes).not.toHaveBeenCalled()
    writes.mockRestore()
  })
})
