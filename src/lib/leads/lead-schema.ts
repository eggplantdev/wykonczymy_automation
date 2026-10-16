import { z } from 'zod'

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

// `.catch([])` degrades a malformed row to "no
// answers" instead of throwing mid-render.
export const leadRawDataSchema = z.array(leadFieldSchema).catch([])

export const formQuestionSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
})

export const formResponseSchema = z.object({
  name: z.string().optional(),
  questions: z.array(formQuestionSchema).optional(),
})

export type LeadFormQuestionT = { key: string; label: string; type?: string }

export const leadFormQuestionsSchema = z
  .array(z.object({ key: z.string(), label: z.string(), type: z.string().optional() }))
  .catch([])

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
