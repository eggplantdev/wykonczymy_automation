import { z } from 'zod'

// The shape of a lead fetched from `GET /{leadgen_id}` — the safety-net contract.
// Deliberately permissive on the parts Meta varies per form (field keys/values)
// while pinning the envelope we depend on.
export const leadFieldSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
})

export const leadSchema = z.object({
  id: z.string(),
  created_time: z.string(),
  field_data: z.array(leadFieldSchema),
  form_id: z.string().optional(),
})

export type LeadFieldT = z.infer<typeof leadFieldSchema>
export type FetchedLeadT = z.infer<typeof leadSchema>
