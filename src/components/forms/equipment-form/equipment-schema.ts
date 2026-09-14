import { z } from 'zod'
import { EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { optionalDay, optionalNonNegativeAmount } from '@/lib/utils/validation'
import {
  equipmentTargetDataShape,
  equipmentTargetFormShape,
  refineExactlyOneTarget,
  refineTargetChoice,
} from '@/lib/schemas/equipment-target'

// Form-input layer: every field is a string, as the HTML controls produce them.
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

// Domain layer the action validates: derived from the form shape so the field list can't drift.
const equipmentDataShape = {
  // `null`, not `''`: the column carries a unique index, and Postgres treats two empty strings as a
  // collision — so the second nameplate-less item would be refused. Two NULLs never collide.
  serialNumber: z.string().nullable(),
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

/**
 * Adding an item and saying where it went are ONE form: an item with no event reads as „nie wiadomo
 * gdzie", which is the register's alarm state — a fresh purchase must never start there.
 */
const addEquipmentFormShape = equipmentFormShape.extend({
  ...equipmentTargetFormShape,
  // Optional, and it belongs to the first EVENT rather than to the item: „kupione na Kwiatową" is a
  // fact about that delivery, not a permanent property of the drill.
  investment: z.string(),
})

export const addEquipmentFormSchema = addEquipmentFormShape.superRefine(refineTargetChoice)

export type AddEquipmentFormValuesT = z.infer<typeof addEquipmentFormShape>

export const addEquipmentSchema = addEquipmentFormShape
  .omit({ targetKind: true })
  .extend({ ...equipmentDataShape, ...equipmentTargetDataShape, investment: z.number().nullable() })
  .superRefine(refineExactlyOneTarget)

export type AddEquipmentDataT = z.infer<typeof addEquipmentSchema>

/** Form values → the item's columns. Every emptied field lands as `null`, never as `''` or `0`. */
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
