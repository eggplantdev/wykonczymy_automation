import { describe, expect, it, vi } from 'vitest'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import type { FailureT } from '@/types/action'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const settle = (result: FailureT) =>
  settleTreeReplace(
    async () => {},
    async () => result,
    'przerwane',
    vi.fn(),
  )

describe('settleTreeReplace', () => {
  it('sends the write only after the pending cell saves have settled', async () => {
    const flush = Promise.withResolvers<void>()
    const write = vi.fn(async () => ({ success: true as const }))

    const result = settleTreeReplace(() => flush.promise, write, 'przerwane', vi.fn())
    await Promise.resolve()
    expect(write).not.toHaveBeenCalled()

    flush.resolve()
    expect(await result).toEqual({ refetch: false })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open on a plain refusal', async () => {
    expect(await settle({ success: false, error: 'Nie wolno' })).toBeNull()
    expect(toastMessage).toHaveBeenCalledWith('Nie wolno', 'error', 6000)
  })

  // Retrying or reopening would rebuild the same stale copy from the grid's rows.
  it('reloads the tree when the refusal says the editor’s copy is stale', async () => {
    const result = await settle({ success: false, error: 'Układ się zmienił', code: 'NOT_FOUND' })

    expect(result).toEqual({ refetch: true })
    expect(toastMessage).toHaveBeenCalledWith('Układ się zmienił', 'error', 6000)
  })
})
