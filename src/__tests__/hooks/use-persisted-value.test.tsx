import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { usePersistedEnum, usePersistedFlag, usePersistedNumber } from '@/hooks/use-persisted-value'

const MODES = ['list', 'grid'] as const

afterEach(() => {
  window.localStorage.clear()
})

describe('usePersistedEnum', () => {
  it('reads a stored valid value', () => {
    window.localStorage.setItem('view', 'grid')
    const { result } = renderHook(() => usePersistedEnum('view', MODES, 'list'))
    expect(result.current[0]).toBe('grid')
  })

  it('falls back on a value outside the allowed set', () => {
    window.localStorage.setItem('view', 'table')
    const { result } = renderHook(() => usePersistedEnum('view', MODES, 'list'))
    expect(result.current[0]).toBe('list')
  })

  it('persists a write and updates every reader in the same tab', () => {
    const first = renderHook(() => usePersistedEnum('view', MODES, 'list'))
    const second = renderHook(() => usePersistedEnum('view', MODES, 'list'))

    act(() => first.result.current[1]('grid'))

    expect(window.localStorage.getItem('view')).toBe('grid')
    expect(second.result.current[0]).toBe('grid')
  })
})

describe('usePersistedNumber', () => {
  const isPositive = (value: number) => value > 0

  it('refuses an empty entry instead of reading it as 0', () => {
    window.localStorage.setItem('width', '')
    const { result } = renderHook(() => usePersistedNumber('width', 320, isPositive))
    expect(result.current[0]).toBe(320)
  })

  it('round-trips a valid number', () => {
    const { result } = renderHook(() => usePersistedNumber('width', 320, isPositive))
    act(() => result.current[1](480))
    expect(result.current[0]).toBe(480)
  })
})

describe('usePersistedFlag', () => {
  it('maps the stored word back to a boolean', () => {
    const { result } = renderHook(() => usePersistedFlag('collapsed', ['yes', 'no'], false))
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(window.localStorage.getItem('collapsed')).toBe('yes')
    expect(result.current[0]).toBe(true)
  })
})
