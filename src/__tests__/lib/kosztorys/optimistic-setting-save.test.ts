import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  optimisticSettingSave,
  reversibleSettingSave,
} from '@/lib/kosztorys/optimistic-setting-save'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const toastMock = vi.mocked(toastMessage)

beforeEach(() => {
  toastMock.mockClear()
})

describe('optimisticSettingSave', () => {
  it('keeps the optimistic patch and stays quiet when the write lands', async () => {
    const revert = vi.fn()

    const ok = await optimisticSettingSave(async () => ({ success: true }), revert, 'Nie udało się')

    expect(ok).toBe(true)
    expect(revert).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('rolls back and reports the server’s own message when the action refuses the write', async () => {
    const revert = vi.fn()

    const ok = await optimisticSettingSave(
      async () => ({ success: false, error: 'Inwestycja jest zamknięta' }),
      revert,
      'Nie udało się zapisać rabatu',
    )

    expect(ok).toBe(false)
    expect(revert).toHaveBeenCalledOnce()
    expect(toastMock).toHaveBeenCalledWith('Inwestycja jest zamknięta', 'warning', 4000)
  })

  // The regression this suite exists for: a transport-level failure (5xx, dropped connection, a
  // deploy mid-flight) makes the server action THROW instead of returning `{success:false}`. That
  // escaped the rollback entirely and propagated to the route's error boundary, replacing the whole
  // editor with „Coś poszło nie tak" while the optimistic patch was still on screen.
  it('rolls back and reports instead of propagating when the action throws', async () => {
    const revert = vi.fn()

    const ok = await optimisticSettingSave(
      async () => {
        throw new Error('An unexpected response was received from the server.')
      },
      revert,
      'Nie udało się zapisać rabatu',
    )

    expect(ok).toBe(false)
    expect(revert).toHaveBeenCalledOnce()
    expect(toastMock).toHaveBeenCalledWith('Nie udało się zapisać rabatu', 'warning', 4000)
  })

  it('treats a rejected promise the same as a throw', async () => {
    const revert = vi.fn()

    await expect(
      optimisticSettingSave(
        () => Promise.reject(new TypeError('Failed to fetch')),
        revert,
        'Nie udało się zapisać stawki VAT',
      ),
    ).resolves.toBe(false)

    expect(revert).toHaveBeenCalledOnce()
    expect(toastMock).toHaveBeenCalledWith('Nie udało się zapisać stawki VAT', 'warning', 4000)
  })
})

// The undo half of the same defect: the rollback put the screen back, but the move still landed on
// the undo stack — so Ctrl+Z spent a step doing nothing. `handleGlobalDiscountChange` already guards
// the no-op case for exactly this reason; a write that never persisted is the same kind of ghost.
describe('reversibleSettingSave', () => {
  it('records the move on the undo stack when the write lands', async () => {
    const push = vi.fn()
    const apply = vi.fn(async () => true)

    await reversibleSettingSave(apply, push, 'Zmiana stawki VAT', 8, 23)

    expect(apply).toHaveBeenCalledWith(23)
    expect(push).toHaveBeenCalledWith('Zmiana stawki VAT', apply, 8, 23)
  })

  it('leaves the undo stack untouched when the write fails', async () => {
    const push = vi.fn()

    await reversibleSettingSave(async () => false, push, 'Zmiana rabatu globalnego', 0, 500)

    expect(push).not.toHaveBeenCalled()
  })

  it('still skips a no-op even when the write lands', async () => {
    const push = vi.fn()

    await reversibleSettingSave(async () => true, push, 'Zmiana stawki VAT', 23, 23)

    expect(push).not.toHaveBeenCalled()
  })
})
