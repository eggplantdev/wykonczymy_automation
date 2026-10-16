import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useRestoreRemount } from '@/components/kosztorys/editor/hooks/use-restore-remount'

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
    rerender({ token: 'rev-1' })
    expect(result.current.remountKey).toBe(0)

    rerender({ token: 'rev-2' })
    expect(result.current.remountKey).toBe(1)
  })

  it('remounts when the fresh tree landed before it was armed', () => {
    const { result, rerender } = renderHook(({ token }) => useRestoreRemount(token), {
      initialProps: { token: 'rev-1' },
    })

    rerender({ token: 'rev-2' })
    act(() => result.current.triggerRestore('rev-1'))

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

  it('disarms when the refresh settles with the same tree — a later write does not remount', () => {
    const { result, rerender } = renderHook(
      ({ token, isRefreshing }) => useRestoreRemount(token, isRefreshing),
      { initialProps: { token: 'rev-1', isRefreshing: false } },
    )

    act(() => result.current.triggerRestore(undefined, true))
    rerender({ token: 'rev-1', isRefreshing: true })
    rerender({ token: 'rev-1', isRefreshing: false })
    rerender({ token: 'rev-2', isRefreshing: false })

    expect(result.current.remountKey).toBe(0)
  })

  it('remounts when the replaced tree lands as the refresh settles', () => {
    const { result, rerender } = renderHook(
      ({ token, isRefreshing }) => useRestoreRemount(token, isRefreshing),
      { initialProps: { token: 'rev-1', isRefreshing: false } },
    )

    act(() => result.current.triggerRestore(undefined, true))
    rerender({ token: 'rev-1', isRefreshing: true })
    rerender({ token: 'rev-2', isRefreshing: false })

    expect(result.current.remountKey).toBe(1)
  })

  it('keeps a later arm the settling refresh does not own', () => {
    const { result, rerender } = renderHook(
      ({ token, isRefreshing }) => useRestoreRemount(token, isRefreshing),
      { initialProps: { token: 'rev-1', isRefreshing: false } },
    )

    act(() => result.current.triggerRestore(undefined, true))
    rerender({ token: 'rev-1', isRefreshing: true })
    act(() => result.current.triggerRestore('rev-1'))
    rerender({ token: 'rev-1', isRefreshing: false })
    rerender({ token: 'rev-2', isRefreshing: false })

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
