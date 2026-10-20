import type { Payload } from 'payload'
import type { OrderSettingsT } from '@/types/order-settings'

export async function readOrderSettings(payload: Payload): Promise<OrderSettingsT> {
  const global = await payload.findGlobal({ slug: 'order-settings', depth: 0 })

  return {
    suppliers: (global.suppliers ?? []).map((row) => ({
      id: row.id ?? '',
      name: row.name,
      phone: row.phone,
    })),
    bigBagPrice: global.bigBagPrice,
    containerPrice: global.containerPrice,
    defaultBigBagSupplierId: global.defaultBigBagSupplierId ?? undefined,
    defaultContainerSupplierId: global.defaultContainerSupplierId ?? undefined,
  }
}
