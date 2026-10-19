import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ORDER_SETTINGS_TAG } from '@/lib/cache/tags'
import { readOrderSettings } from '@/lib/orders/read-order-settings'
import type { OrderSettingsT } from '@/types/order-settings'

export const fetchOrderSettings = cached(
  async (): Promise<OrderSettingsT> => readOrderSettings(await getPayload({ config })),
  ['order-settings'],
  { tags: [ORDER_SETTINGS_TAG] },
)
