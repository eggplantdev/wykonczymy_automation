import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'

// The latch behind every whole-tree reseed — a restore, and the importer's apply. Its two failure
// modes are opposite and both silent: remount when nobody asked and the editor throws away the
// user's sort, filters and optimistic rows on an ordinary edit (lessons.md); fail to remount and the
// body keeps rendering the kosztorys that was just replaced, with no error anywhere.
//
// The subtlety is WHY the latch exists at all: the router applies a fresh tree inside a transition
// whose commit nothing can await, so remounting straight from the action's continuation would reseed
// the body from the tree it already holds. Hence „arm now, fire when the fresh token lands" — a rule
// about render ordering, which is why it is asserted here and not in a browser.
describe('useRestoreRemount', () => {
  it('ignores a fresh tree nobody armed it for', () => {
    const { result, rerender } = renderHook(({ token }) => useRestoreRemount(token), {
      initialProps: { token: 'rev-1' },
    })

    rerender({ token: 'rev-2' })

    expect(result.current.remountKey).toBe(0)
  })

  it('waits while armed and fires only when the tree actually changes', () => {
    const { result, rerender } = renderHook(({ token }) => useRestoreRemount(token), {
      initialProps: { token: 'rev-1' },
    })

    act(() => result.current.triggerRestore())
    // Arming alone must not remount: at this point the server has not answered yet, so the body would
    // be reseeded from the pre-restore tree — the exact bug the latch was written to prevent.
    rerender({ token: 'rev-1' })
    expect(result.current.remountKey).toBe(0)

    rerender({ token: 'rev-2' })
    expect(result.current.remountKey).toBe(1)
  })

  it('is one-shot — the next routine refresh does not remount', () => {
    const { result, rerender } = renderHook(({ token }) => useRestoreRemount(token), {
      initialProps: { token: 'rev-1' },
    })

    act(() => result.current.triggerRestore())
    rerender({ token: 'rev-2' })
    rerender({ token: 'rev-3' })

    expect(result.current.remountKey).toBe(1)
  })

  it('arms again for a second restore', () => {
    const { result, rerender } = renderHook(({ token }) => useRestoreRemount(token), {
      initialProps: { token: 'rev-1' },
    })

    act(() => result.current.triggerRestore())
    rerender({ token: 'rev-2' })

    act(() => result.current.triggerRestore())
    rerender({ token: 'rev-3' })

    expect(result.current.remountKey).toBe(2)
  })
})
