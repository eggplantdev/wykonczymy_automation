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

// A form question as returned by `GET /{form_id}?fields=questions`. `label` is the
// human question text we persist to render real questions in the answers modal.
export const formQuestionSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
})

export const formQuestionsResponseSchema = z.object({
  questions: z.array(formQuestionSchema).optional(),
})

// What we persist on the lead (`formQuestions`), ordered: the key→label map the
// answers modal renders, plus the Meta field `type` — the most reliable signal
// for normalizeLead (EMAIL/PHONE/FULL_NAME) when it's available.
export type LeadFormQuestionT = { key: string; label: string; type?: string }

/**
 * Project raw Graph/dump questions (`{key, label?, type?}`) into the persisted
 * `LeadFormQuestionT[]`, dropping label-less entries (nothing to render). Shared
 * by the webhook fetch and the backfill script so the projection lives once.
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
