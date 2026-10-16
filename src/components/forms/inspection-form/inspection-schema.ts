import { z } from 'zod'
import { INSPECTION_TYPES } from '@/lib/fleet/inspection-types'

export const inspectionFormSchema = z.object({
  vehicle: z.string().min(1, 'Pojazd jest wymagany'),
  type: z.enum(INSPECTION_TYPES),
  performedAt: z.string().min(1, 'Data wykonania jest wymagana'),
  nextDueAt: z.string(),
  odometer: z.string(),
  cost: z
    .string()
    .refine((value) => value === '' || Number(value) >= 0, 'Koszt nie może być ujemny'),
  insurer: z.string(),
  policyNumber: z.string(),
  note: z.string(),
})

export type InspectionFormValuesT = z.infer<typeof inspectionFormSchema>

export const inspectionSchema = z.object({
  vehicle: z.number(),
  type: z.enum(INSPECTION_TYPES),
  performedAt: z.string().min(1, 'Data wykonania jest wymagana'),
  nextDueAt: z.string().optional(),
  odometer: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().nullable(),
  insurer: z.string().default(''),
  // Text, never a number — `354E000003305` is not finite as a float and `22044 4672279` has a space.
  policyNumber: z.string().default(''),
  note: z.string().default(''),
  attachments: z.array(z.number()).default([]),
})

export type InspectionFormDataT = z.infer<typeof inspectionSchema>
