import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkshopMirrorFlush } from '@/components/kosztorys/editor/hooks/use-workshop-mirror-flush'
import { PRESET_MIRROR_IDLE_FLUSH_MS } from '@/lib/constants/preset-mirror'
import { flushWorkshopPresetAction } from '@/lib/actions/kosztorys-presets'

// The risk here is purely lifecycle — how many times the flush fires and when — so time is driven
// by hand and the calls to the action are the only observable.
vi.mock('@/lib/actions/kosztorys-presets', () => ({
  flushWorkshopPresetAction: vi.fn().mockResolvedValue({ success: true }),
}))

const flush = vi.mocked(flushWorkshopPresetAction)

function renderFlush(templatePresetId: number | undefined, revision = { current: 0 }) {
  const view = renderHook(() => useWorkshopMirrorFlush(templatePresetId, revision))
  return { ...view, revision }
}

describe('useWorkshopMirrorFlush', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    flush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dopycha po bezczynności, gdy coś się zmieniło', () => {
    const { revision } = renderFlush(7)

    revision.current = 1
    act(() => void vi.advanceTimersByTime(PRESET_MIRROR_IDLE_FLUSH_MS))

    expect(flush).toHaveBeenCalledExactlyOnceWith(7)
  })

  // An open, untouched tab would otherwise rewrite a quarter-megabyte jsonb every quarter hour.
  it('nie dopycha, gdy nic nie tknięto', () => {
    renderFlush(7)

    act(() => void vi.advanceTimersByTime(PRESET_MIRROR_IDLE_FLUSH_MS * 3))

    expect(flush).not.toHaveBeenCalled()
  })

  it('dopycha przy wyjściu z edytora', () => {
    const { unmount, revision } = renderFlush(7)

    revision.current = 1
    unmount()

    expect(flush).toHaveBeenCalledExactlyOnceWith(7)
  })

  // Leaving is the one teardown guaranteed on every navigation, so an unguarded flush here would
  // stamp a fresh modification date on a szablon that was only ever opened — and that date is what
  // the library sorts by.
  it('nie dopycha przy wyjściu, gdy nic nie tknięto', () => {
    const { unmount } = renderFlush(7)

    unmount()

    expect(flush).not.toHaveBeenCalled()
  })

  // A plain investment holds no szablon, and the same editor renders both.
  it('milczy bez wskaźnika szablonu', () => {
    const { unmount, revision } = renderFlush(undefined)

    revision.current = 1
    act(() => void vi.advanceTimersByTime(PRESET_MIRROR_IDLE_FLUSH_MS * 2))
    unmount()

    expect(flush).not.toHaveBeenCalled()
  })
})
