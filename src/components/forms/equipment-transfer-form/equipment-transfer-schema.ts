import { z } from 'zod'
import { optionalNonNegativeAmount } from '@/lib/utils/validation'
import {
  equipmentTargetDataShape,
  equipmentTargetFormShape,
  refineExactlyOneTarget,
  refineTargetChoice,
} from '@/lib/schemas/equipment-target'

const transferFormShape = z.object({
  ...equipmentTargetFormShape,
  equipment: z.string().min(1, 'Sprzęt jest wymagany'),
  investment: z.string(),
  cost: optionalNonNegativeAmount('Koszt nie może być ujemny'),
  note: z.string(),
})

export const equipmentTransferFormSchema = transferFormShape.superRefine(refineTargetChoice)

export type EquipmentTransferFormValuesT = z.infer<typeof transferFormShape>

export const equipmentTransferSchema = transferFormShape
  .omit({ targetKind: true })
  .extend({
    ...equipmentTargetDataShape,
    equipment: z.number(),
    investment: z.number().nullable(),
    cost: z.number().nonnegative().nullable(),
    note: z.string().default(''),
  })
  .superRefine(refineExactlyOneTarget)

export type EquipmentTransferDataT = z.infer<typeof equipmentTransferSchema>
