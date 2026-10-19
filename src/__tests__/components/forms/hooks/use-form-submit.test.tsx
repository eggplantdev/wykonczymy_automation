import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { toastMessage } from '@/lib/utils/toast'

describe('useFormSubmit — „Zostaw otwarte"', () => {
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

describe('useFormSubmit — awaitBeforeClose', () => {
  it('leaves the dialog open and the form filled when the save fails', async () => {
    const onSubmitSuccess = vi.fn()
    const onReset = vi.fn()
    const { result } = renderHook(() => useFormSubmit('edit-vehicle-1'))

    await act(() =>
      result.current.submit(false, {
        action: async () => ({ success: false, error: 'Nie udało się zapisać' }),
        successMessage: 'OK',
        onSubmitSuccess,
        onReset,
        awaitBeforeClose: true,
      }),
    )

    expect(toastMessage).toHaveBeenCalledWith('Nie udało się zapisać', 'error')
    expect(onSubmitSuccess).not.toHaveBeenCalled()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('closes the dialog only once the save has succeeded', async () => {
    const save = Promise.withResolvers<{ success: true }>()
    const onSubmitSuccess = vi.fn()
    const { result } = renderHook(() => useFormSubmit('edit-vehicle-1'))

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.submit(false, {
        action: () => save.promise,
        successMessage: 'Zapisano',
        onSubmitSuccess,
        onReset: vi.fn(),
        awaitBeforeClose: true,
      })
    })
    expect(onSubmitSuccess).not.toHaveBeenCalled()

    await act(async () => {
      save.resolve({ success: true })
      await pending
    })

    expect(onSubmitSuccess).toHaveBeenCalledOnce()
    expect(toastMessage).toHaveBeenCalledWith('Zapisano', 'success')
  })
})
