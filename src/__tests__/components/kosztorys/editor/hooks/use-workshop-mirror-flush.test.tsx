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

// jsdom reports the document permanently visible, so the state is stubbed rather than driven.
function hideTab(state: DocumentVisibilityState = 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => void document.dispatchEvent(new Event('visibilitychange')))
}

describe('useWorkshopMirrorFlush', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    flush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    hideTab('visible')
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

  // Closing a tab unmounts nothing and outruns the interval; hiding it is the last moment the page
  // is still alive enough to send anything.
  it('dopycha, gdy karta znika z widoku', () => {
    const { revision } = renderFlush(7)

    revision.current = 1
    hideTab()

    expect(flush).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('nie dopycha przy zniknięciu karty, gdy nic nie tknięto', () => {
    renderFlush(7)

    hideTab()

    expect(flush).not.toHaveBeenCalled()
  })

  // Switching back and forth between tabs must not re-send what the first hide already sent.
  it('nie dopycha drugi raz, gdy karta wraca i znowu znika bez zmian', () => {
    const { revision } = renderFlush(7)

    revision.current = 1
    hideTab()
    hideTab('visible')
    hideTab()

    expect(flush).toHaveBeenCalledExactlyOnceWith(7)
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
