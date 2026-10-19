import { z } from 'zod'

import { isOrderPrice } from '@/lib/orders/order-price'
import { randomId } from '@/lib/utils/random-id'

const PRICE_FORMAT_ERROR = 'Cena musi być większa niż 0, najwyżej 2 miejsca po przecinku'

const supplierShape = {
  name: z.string().trim().min(1, 'Nazwa jest wymagana'),
  phone: z.string().trim().min(1, 'Telefon jest wymagany'),
}

const storedPrice = z.number().refine((price) => isOrderPrice(String(price)), PRICE_FORMAT_ERROR)

export const orderSettingsSchema = z.object({
  suppliers: z.array(z.object({ id: z.string().optional(), ...supplierShape })),
  bigBagPrice: storedPrice,
  containerPrice: storedPrice,
})

export type OrderSettingsDataT = z.infer<typeof orderSettingsSchema>

const priceField = z.string().refine(isOrderPrice, PRICE_FORMAT_ERROR)

export const orderSettingsFormSchema = z.object({
  suppliers: z.array(z.object({ id: z.string(), ...supplierShape })),
  bigBagPrice: priceField,
  containerPrice: priceField,
})

export type OrderSettingsFormValuesT = z.infer<typeof orderSettingsFormSchema>

export const makeSupplierRow = (): OrderSettingsFormValuesT['suppliers'][number] => ({
  id: randomId(),
  name: '',
  phone: '',
})
