import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import { toastMessage } from '@/lib/utils/toast'

describe('useDebouncedSave — a request that never completed', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))

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
