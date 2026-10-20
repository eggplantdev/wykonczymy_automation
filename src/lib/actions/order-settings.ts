'use server'

import { z } from 'zod'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import {
  orderSettingsSchema,
  type OrderSettingsDataT,
} from '@/components/forms/order-settings-form/order-settings-schema'
import { revalidateOrderSettings } from '@/lib/cache/revalidate'
import { ORDER_ITEMS, ORDER_ITEM_KINDS, type OrderItemT } from '@/lib/constants/orders'
import { readOrderSettings } from '@/lib/orders/read-order-settings'
import type { ActionResultT } from '@/types/action'

const FORBIDDEN = 'Tylko właściciel może zmieniać dostawców i ceny'

// `updateGlobal` writes the whole document, so each action re-sends the keys it does not own.
export async function saveOrderSettingsAction(data: OrderSettingsDataT): Promise<ActionResultT> {
  return ownerOnlyAction('saveOrderSettingsAction', FORBIDDEN, async ({ payload }) => {
    const parsed = validateAction(orderSettingsSchema, data)
    if (!parsed.success) return parsed

    const keptDefault = (supplierId: string | undefined) =>
      supplierId && parsed.data.suppliers.some((row) => row.id === supplierId) ? supplierId : null

    await payload.updateGlobal({
      slug: 'order-settings',
      data: {
        ...parsed.data,
        defaultBigBagSupplierId: keptDefault(parsed.data.defaultBigBagSupplierId),
        defaultContainerSupplierId: keptDefault(parsed.data.defaultContainerSupplierId),
      },
    })

    revalidateOrderSettings()
    return { success: true }
  })
}

const defaultSupplierSchema = z.object({
  kind: z.enum(ORDER_ITEM_KINDS),
  supplierId: z.string().min(1),
})

export async function setDefaultSupplierAction(
  kind: OrderItemT,
  supplierId: string,
): Promise<ActionResultT> {
  return protectedAction('setDefaultSupplierAction', async ({ payload }) => {
    const parsed = validateAction(defaultSupplierSchema, { kind, supplierId })
    if (!parsed.success) return parsed

    const current = await readOrderSettings(payload)
    if (!current.suppliers.some((row) => row.id === parsed.data.supplierId)) {
      return { success: false, error: 'Nie ma takiego dostawcy — odśwież stronę.' }
    }

    await payload.updateGlobal({
      slug: 'order-settings',
      data: {
        ...current,
        [ORDER_ITEMS[parsed.data.kind].defaultSupplierKey]: parsed.data.supplierId,
      },
    })

    revalidateOrderSettings()
    return { success: true }
  })
}
