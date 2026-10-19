import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

type RowT = { id: number; active: boolean }

const rows: RowT[] = [
  { id: 1, active: true },
  { id: 2, active: true },
]

describe('useOptimisticToggle', () => {
  it('flips the row before the server answers and reverts with a toast on failure', async () => {
    let settle: (result: ActionResultT) => void = () => {}
    const serverAction = vi.fn(
      () => new Promise<ActionResultT>((resolve) => (settle = resolve)),
    )
    const { result } = renderHook(() =>
      useOptimisticToggle(rows, (active) => ({ active }), serverAction),
    )

    act(() => result.current.handleToggle(2, false))
    await waitFor(() => expect(result.current.optimisticData[1].active).toBe(false))
    expect(result.current.optimisticData[0].active).toBe(true)
    expect(serverAction).toHaveBeenCalledWith(2, false)

    await act(async () => settle({ success: false, error: 'Nie udało się' }))
    expect(result.current.optimisticData[1].active).toBe(true)
    expect(toastMessage).toHaveBeenCalledWith('Nie udało się', 'error')
  })
})
