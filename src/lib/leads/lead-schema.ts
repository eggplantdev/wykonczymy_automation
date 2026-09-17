import { z } from 'zod'

// `GET /{leadgen_id}` — permissive on the parts Meta varies per form (field keys/values), pinning
// only the envelope we depend on.
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

// The untyped `json` columns can hold a shape our writers never produced (admin edits, legacy
// backfills), so narrow with a parse, not an `as`. `.catch([])` degrades a malformed row to "no
// answers" instead of throwing mid-render.
export const leadRawDataSchema = z.array(leadFieldSchema).catch([])

// `GET /{form_id}?fields=name,questions`. `label` is the human question text, persisted so the
// answers modal renders real questions.
export const formQuestionSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
})

export const formResponseSchema = z.object({
  name: z.string().optional(),
  questions: z.array(formQuestionSchema).optional(),
})

// Ordered. The Meta field `type` is normalizeLead's most reliable signal (EMAIL/PHONE/FULL_NAME)
// when it is available.
export type LeadFormQuestionT = { key: string; label: string; type?: string }

// `label` is always present — `toLeadFormQuestions` drops label-less entries before storing.
export const leadFormQuestionsSchema = z
  .array(z.object({ key: z.string(), label: z.string(), type: z.string().optional() }))
  .catch([])

/**
 * Drops label-less entries (nothing to render). Shared by the webhook fetch and the backfill script
 * so the projection lives once.
 */
export function toLeadFormQuestions(
  questions: readonly { key: string; label?: string; type?: string }[] | undefined,
): LeadFormQuestionT[] {
  return (questions ?? [])
    .filter((question) => question.label)
    .map((question) => ({
      key: question.key,
      label: question.label as string,
      type: question.type,
    }))
}
