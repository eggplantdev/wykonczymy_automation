import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

describe('useDebouncedSave — a request that never completed (EX-940)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  // The reseed rides the same dead connection and wipes the undo stack with no tree coming back, so a
  // transport failure must roll the one cell back — never route to the stale-tree recovery.
  it('reverts the cell with a Polish toast and never reseeds', async () => {
    const onStale = vi.fn()
    const revert = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(500, onStale))

    await act(() =>
      result.current.runNow(
        'item:1:plannedQty',
        () => Promise.reject(new TypeError('Failed to fetch')),
        revert,
      ),
    )

    expect(revert).toHaveBeenCalledOnce()
    expect(onStale).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/Brak połączenia z serwerem/),
      'error',
      5000,
    )
  })
})
