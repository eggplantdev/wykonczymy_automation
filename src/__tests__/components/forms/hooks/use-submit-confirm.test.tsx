import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSubmitConfirm } from '@/components/forms/hooks/use-submit-confirm'

const COPY = { title: 'Brak faktury', description: 'Ta pozycja nie ma załączonej faktury.' }

describe('useSubmitConfirm', () => {
  it('resolves true on confirm and closes the dialog', async () => {
    const { result } = renderHook(() => useSubmitConfirm())

    let answer: Promise<boolean> | undefined
    act(() => {
      answer = result.current.ask(COPY)
    })
    expect(result.current.dialogProps).toMatchObject({ open: true, title: 'Brak faktury' })

    await act(async () => {
      result.current.dialogProps.onConfirm()
      // The dialog fires onCancel on every close, the confirm included — it must not flip the answer.
      result.current.dialogProps.onCancel()
    })

    await expect(answer).resolves.toBe(true)
    expect(result.current.dialogProps.open).toBe(false)
  })

  it('resolves false on cancel and closes the dialog', async () => {
    const { result } = renderHook(() => useSubmitConfirm())

    let answer: Promise<boolean> | undefined
    act(() => {
      answer = result.current.ask(COPY)
    })
    await act(async () => result.current.dialogProps.onCancel())

    await expect(answer).resolves.toBe(false)
    expect(result.current.dialogProps.open).toBe(false)
  })
})
