'use server'

import { z } from 'zod'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import {
  orderSettingsSchema,
  type OrderSettingsDataT,
} from '@/components/forms/order-settings-form/order-settings-schema'
import { revalidateOrderSettings } from '@/lib/cache/revalidate'
import { readOrderSettings } from '@/lib/orders/read-order-settings'
import type { ActionResultT } from '@/types/action'

const FORBIDDEN = 'Tylko właściciel może zmieniać dostawców i ceny'

// `updateGlobal` writes the whole document, so each action re-sends the keys it does not own.
export async function saveOrderSettingsAction(data: OrderSettingsDataT): Promise<ActionResultT> {
  return ownerOnlyAction('saveOrderSettingsAction', FORBIDDEN, async ({ payload }) => {
    const parsed = validateAction(orderSettingsSchema, data)
    if (!parsed.success) return parsed

    const { defaultSupplierId } = await readOrderSettings(payload)
    const keepsDefault = parsed.data.suppliers.some((row) => row.id === defaultSupplierId)

    await payload.updateGlobal({
      slug: 'order-settings',
      data: { ...parsed.data, defaultSupplierId: keepsDefault ? defaultSupplierId : null },
    })

    revalidateOrderSettings()
    return { success: true }
  })
}

const supplierIdSchema = z.string().min(1)

export async function setDefaultSupplierAction(supplierId: string): Promise<ActionResultT> {
  return protectedAction('setDefaultSupplierAction', async ({ payload }) => {
    const parsed = validateAction(supplierIdSchema, supplierId)
    if (!parsed.success) return parsed

    const current = await readOrderSettings(payload)
    if (!current.suppliers.some((row) => row.id === parsed.data)) {
      return { success: false, error: 'Nie ma takiego dostawcy — odśwież stronę.' }
    }

    await payload.updateGlobal({
      slug: 'order-settings',
      data: { ...current, defaultSupplierId: parsed.data },
    })

    revalidateOrderSettings()
    return { success: true }
  })
}
