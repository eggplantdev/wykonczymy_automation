import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'

// Guards two silent failure modes: remounting on nothing (throws away sort/filters — lessons.md)
// or never remounting (renders the replaced tree with no error). The router's commit can't be
// awaited, so this arms on restore/apply and fires only once the fresh token lands — a render-order
// rule, tested here rather than in a browser.
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
    // Arming alone must not remount — the server hasn't answered yet, so the body would reseed
    // from the pre-restore tree.
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
