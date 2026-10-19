'use server'

import { z } from 'zod'

import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { ORDER_STATUSES, type OrderStatusT } from '@/lib/constants/orders'
import type { ActionResultT } from '@/types/action'

export async function setOrderStatusAction(
  transferId: number,
  status: OrderStatusT,
): Promise<ActionResultT> {
  return protectedAction(
    `setOrderStatusAction transaction=${transferId}`,
    async ({ payload, user }) => {
      const parsed = validateAction(
        z.enum(ORDER_STATUSES, { error: 'Nieznany status zamówienia.' }),
        status,
      )
      if (!parsed.success) return parsed

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

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { orderStatus: parsed.data, updatedBy: user.id },
        context: { skipSheetSync: true },
        user,
      })
      return { success: true }
    },
    ['transfers'],
  )
}
