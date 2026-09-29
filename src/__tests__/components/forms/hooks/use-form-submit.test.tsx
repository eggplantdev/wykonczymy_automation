import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('useFormSubmit — „Zostaw otwarte"', () => {
  // Staging, offline: the browser's own „Failed to fetch" reached the toast verbatim.
  it('reports a failed request in Polish and keeps the form filled', async () => {
    const onReset = vi.fn()
    const { result } = renderHook(() => useFormSubmit('transfer'))

    await act(() =>
      result.current.submit(true, {
        action: () => Promise.reject(new TypeError('Failed to fetch')),
        successMessage: 'OK',
        onSubmitSuccess: vi.fn(),
        onReset,
      }),
    )

    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^Brak połączenia z serwerem/),
      'error',
    )
    expect(onReset).not.toHaveBeenCalled()
  })
})
