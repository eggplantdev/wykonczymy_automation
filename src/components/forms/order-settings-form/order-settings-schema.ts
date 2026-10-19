import { z } from 'zod'

import { randomId } from '@/lib/utils/random-id'

const PRICE_ERROR = 'Cena musi być większa niż 0'

const supplierShape = {
  name: z.string().trim().min(1, 'Nazwa jest wymagana'),
  phone: z.string().trim().min(1, 'Telefon jest wymagany'),
}

export const orderSettingsSchema = z.object({
  suppliers: z.array(z.object({ id: z.string().optional(), ...supplierShape })),
  bigBagPrice: z.number().positive(PRICE_ERROR),
  containerPrice: z.number().positive(PRICE_ERROR),
})

export type OrderSettingsDataT = z.infer<typeof orderSettingsSchema>

const priceField = z.string().refine((value) => value !== '' && Number(value) > 0, PRICE_ERROR)

export const orderSettingsFormSchema = z.object({
  suppliers: z.array(z.object({ id: z.string(), ...supplierShape })),
  bigBagPrice: priceField,
  containerPrice: priceField,
})

export type OrderSettingsFormValuesT = z.infer<typeof orderSettingsFormSchema>

// A new row's id is kept by Payload, so the default supplier can point at it after the save.
export const makeSupplierRow = (): OrderSettingsFormValuesT['suppliers'][number] => ({
  id: randomId(),
  name: '',
  phone: '',
})
