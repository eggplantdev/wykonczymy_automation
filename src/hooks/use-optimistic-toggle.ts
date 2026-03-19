import { useOptimistic, startTransition, useCallback } from 'react'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

export function useOptimisticToggle<TRow extends { id: number }>(
  data: TRow[],
  getUpdate: (newActive: boolean) => Partial<TRow>,
  serverAction: (id: number, newActive: boolean) => Promise<ActionResultT>,
) {
  const [optimisticData, addOptimistic] = useOptimistic(
    data,
    (current, { id, update }: { id: number; update: Partial<TRow> }) =>
      current.map((row) => (row.id === id ? ({ ...row, ...update } as TRow) : row)),
  )

  const handleToggle = useCallback(
    (id: number, newActive: boolean) => {
      startTransition(async () => {
        addOptimistic({ id, update: getUpdate(newActive) })
        const result = await serverAction(id, newActive)
        if (!result.success) toastMessage(result.error, 'error')
      })
    },
    [addOptimistic, getUpdate, serverAction],
  )

  return { optimisticData, handleToggle } as const
}
