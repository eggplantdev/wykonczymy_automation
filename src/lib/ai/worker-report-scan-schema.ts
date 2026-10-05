import { z } from 'zod'

export type ScanUnitT = { value: string; label: string }

/**
 * What the model may answer for one photo. An extra's j.m. is an enum of the kosztorys's units, so a
 * handwritten one that fits none comes back null instead of a unit the review would have to reject.
 */
export const workerReportScanSchema = (units: readonly ScanUnitT[]) => {
  const values = units.map((unit) => unit.value)
  const unitSchema =
    values.length > 0 ? z.enum(values as [string, ...string[]]).nullable() : z.null()
  return z.object({
    rows: z.array(
      z.object({
        ref: z.string(),
        qty: z.number().nullable(),
        isUncertain: z.boolean(),
        description: z.string().optional(),
      }),
    ),
    extras: z.array(
      z.object({
        description: z.string(),
        unit: unitSchema,
        qty: z.number().nullable(),
        isUncertain: z.boolean(),
      }),
    ),
  })
}
