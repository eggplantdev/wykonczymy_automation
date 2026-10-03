import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from '@/hooks/use-media-query'

const originalMatchMedia = window.matchMedia

function stubViewport(initiallyMatches: boolean) {
  const state = { matches: initiallyMatches }
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        get matches() {
          return state.matches
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )
  return {
    resize: (matches: boolean) => {
      state.matches = matches
      listeners.forEach((listener) => listener())
    },
    listeners,
  }
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('useMediaQuery', () => {
  it('reads the viewport on the first client render', () => {
    stubViewport(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('follows the viewport across the breakpoint in both directions', () => {
    const viewport = stubViewport(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => viewport.resize(true))
    expect(result.current).toBe(true)

    act(() => viewport.resize(false))
    expect(result.current).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const viewport = stubViewport(false)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    unmount()

    expect(viewport.listeners.size).toBe(0)
  })
})
