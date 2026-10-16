import { z } from 'zod'
import { EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { optionalDay, optionalNonNegativeAmount } from '@/lib/utils/validation'
import {
  equipmentTargetDataShape,
  equipmentTargetFormShape,
  refineExactlyOneTarget,
  refineTargetChoice,
} from '@/lib/schemas/equipment-target'

const equipmentFormShape = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  serialNumber: z.string(),
  make: z.string(),
  model: z.string(),
  purchaseDate: optionalDay(),
  warrantyUntil: optionalDay(),
  purchasePrice: optionalNonNegativeAmount('Cena nie może być ujemna'),
  note: z.string(),
  status: z.enum(EQUIPMENT_STATUSES),
})

export const equipmentFormSchema = equipmentFormShape

export type EquipmentFormValuesT = z.infer<typeof equipmentFormShape>

const equipmentDataShape = {
  // the column carries a unique index, and Postgres treats two empty strings as a
  // collision — so the second nameplate-less item would be refused.
  serialNumber: z.string().trim().nullable(),
  purchaseDate: z.string().nullable(),
  warrantyUntil: z.string().nullable(),
  // `null`, not `undefined`: Payload reads a missing key on update as „leave the column alone", so
  // an emptied „Cena zakupu" would save without clearing anything.
  purchasePrice: z.number().nonnegative().nullable(),
  make: z.string().default(''),
  model: z.string().default(''),
  note: z.string().default(''),
}

export const equipmentSchema = equipmentFormShape.extend(equipmentDataShape)

export type EquipmentFormDataT = z.infer<typeof equipmentSchema>

const addEquipmentFormShape = equipmentFormShape.extend({
  ...equipmentTargetFormShape,
  investment: z.string(),
})

export const addEquipmentFormSchema = addEquipmentFormShape.superRefine(refineTargetChoice)

export type AddEquipmentFormValuesT = z.infer<typeof addEquipmentFormShape>

export const addEquipmentSchema = addEquipmentFormShape
  .omit({ targetKind: true })
  .extend({ ...equipmentDataShape, ...equipmentTargetDataShape, investment: z.number().nullable() })
  .superRefine(refineExactlyOneTarget)

export type AddEquipmentDataT = z.infer<typeof addEquipmentSchema>

export function toEquipmentData(values: EquipmentFormValuesT): EquipmentFormDataT {
  return {
    name: values.name.trim(),
    serialNumber: values.serialNumber.trim() || null,
    make: values.make,
    model: values.model,
    purchaseDate: values.purchaseDate || null,
    warrantyUntil: values.warrantyUntil || null,
    purchasePrice: values.purchasePrice === '' ? null : Number(values.purchasePrice),
    note: values.note,
    status: values.status,
  }
}
