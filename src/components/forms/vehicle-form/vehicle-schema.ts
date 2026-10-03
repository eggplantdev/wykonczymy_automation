import { z } from 'zod'
import { SCHEDULED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'

// Form-input layer: every field is a string, as the HTML controls produce them.
export const vehicleFormSchema = z.object({
  registration: z.string().min(1, 'Numer rejestracyjny jest wymagany'),
  make: z.string().min(1, 'Marka jest wymagana'),
  model: z.string().min(1, 'Model jest wymagany'),
  year: z.string(),
  vin: z.string(),
  // Free text, not an enum: the owner writes „całosezonowe ale do wymiany" there, and half of that
  // sentence is the half worth keeping.
  tyres: z.string(),
  note: z.string(),
  exemptions: z.array(z.enum(SCHEDULED_INSPECTION_TYPES)),
  status: z.enum(VEHICLE_STATUSES),
})

export type VehicleFormValuesT = z.infer<typeof vehicleFormSchema>

// Domain layer the action validates: derived from the form schema so the field list can't drift.
export const vehicleSchema = vehicleFormSchema.extend({
  // The unique index is case-sensitive, and the clash check reads the plate in this shape.
  registration: z.string().trim().toUpperCase().min(1, 'Numer rejestracyjny jest wymagany'),
  // `null`, not `undefined`: Payload reads a missing key on update as "leave the column alone", so an
  // optional year would make an emptied „Rocznik" field save silently without clearing anything.
  year: z.number().int().min(1900).max(2100).nullable(),
  vin: z.string().default(''),
  tyres: z.string().default(''),
  note: z.string().default(''),
})

export type VehicleFormDataT = z.infer<typeof vehicleSchema>
