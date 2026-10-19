'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { isOrderStatus, type OrderStatusT } from '@/lib/constants/orders'
import type { ActionResultT } from '@/types/action'

export async function setOrderStatusAction(
  transferId: number,
  status: OrderStatusT,
): Promise<ActionResultT> {
  return protectedAction(
    `setOrderStatusAction transaction=${transferId}`,
    async ({ payload }) => {
      if (!isOrderStatus(status)) return { success: false, error: 'Nieznany status zamówienia.' }

      const original = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })
      if (original.cancelled) {
        return { success: false, error: 'Anulowanej transakcji nie można zmienić.' }
      }
      if (!original.orderStatus) {
        return { success: false, error: 'Ta transakcja nie jest zamówieniem.' }
      }

      // The validate hook still runs, so a locked investment refuses the write.
      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { orderStatus: status },
        context: { skipSheetSync: true },
      })
      return { success: true }
    },
    ['transfers'],
  )
}
