import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

const KEY = 'table-columns:kosztorys-totals-open'
const EMPTY_KEY = 'table-columns:kosztorys-totals-open-empty'

beforeEach(() => localStorage.clear())

describe('useTotalsPanelOpen', () => {
  it('starts open where there are rows and collapsed where there are none', () => {
    expect(renderHook(() => useTotalsPanelOpen(true)).result.current[0]).toBe(true)
    expect(renderHook(() => useTotalsPanelOpen(false)).result.current[0]).toBe(false)
  })

  // An empty kosztorys shows its figures as zeros over the „Pobierz z arkusza Google…" screen, so the
  // preference built up on a kosztorys with rows must not decide a fresh investment's first screen.
  it('leaves the empty kosztorys collapsed even with the row preference stored open', () => {
    localStorage.setItem(KEY, 'open')

    expect(renderHook(() => useTotalsPanelOpen(false)).result.current[0]).toBe(false)
  })

  it('keeps the two preferences apart when either is written', () => {
    const empty = renderHook(() => useTotalsPanelOpen(false))
    act(() => empty.result.current[1](true))

    expect(empty.result.current[0]).toBe(true)
    expect(localStorage.getItem(EMPTY_KEY)).toBe('open')
    expect(localStorage.getItem(KEY)).toBeNull()

    const withRows = renderHook(() => useTotalsPanelOpen(true))
    act(() => withRows.result.current[1](false))

    expect(localStorage.getItem(KEY)).toBe('closed')
    expect(localStorage.getItem(EMPTY_KEY)).toBe('open')
    expect(empty.result.current[0]).toBe(true)
  })
})
