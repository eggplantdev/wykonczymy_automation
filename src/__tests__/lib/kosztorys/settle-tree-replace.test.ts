import { describe, expect, it, vi } from 'vitest'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import type { FailureT } from '@/types/action'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const settle = (result: FailureT) => settleTreeReplace(async () => result, 'przerwane', vi.fn())

describe('settleTreeReplace', () => {
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
