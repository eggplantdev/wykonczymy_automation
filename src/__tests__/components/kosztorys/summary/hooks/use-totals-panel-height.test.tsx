import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTotalsPanelHeight } from '@/components/kosztorys/summary/hooks/use-totals-panel-height'

const KEY = 'table-columns:kosztorys-totals-height'

beforeEach(() => localStorage.clear())

describe('useTotalsPanelHeight', () => {
  it('starts at full height, the panel as it was before it could be dragged', () => {
    expect(renderHook(() => useTotalsPanelHeight()).result.current[0]).toBe(1)
  })

  it('persists a written height and reads it back', () => {
    const { result } = renderHook(() => useTotalsPanelHeight())
    act(() => result.current[1](0.4))

    expect(result.current[0]).toBe(0.4)
    expect(localStorage.getItem(KEY)).toBe('0.4')
    expect(renderHook(() => useTotalsPanelHeight()).result.current[0]).toBe(0.4)
  })

  it.each(['', 'abc', '0', '5'])('reads a stored %j as full height', (stored) => {
    localStorage.setItem(KEY, stored)

    expect(renderHook(() => useTotalsPanelHeight()).result.current[0]).toBe(1)
  })

  // The overlay writes on release and the editor body reads it to size the grid — two hooks.
  it('re-renders another reader in the same tab when one writes', () => {
    const writer = renderHook(() => useTotalsPanelHeight())
    const reader = renderHook(() => useTotalsPanelHeight())
    act(() => writer.result.current[1](0.5))

    expect(reader.result.current[0]).toBe(0.5)
  })
})
