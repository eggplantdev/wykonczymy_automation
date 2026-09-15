import { serverEnv } from '@/lib/env/server'
import { formResponseSchema, toLeadFormQuestions, type LeadFormQuestionT } from './lead-schema'

export type LeadFormT = {
  name?: string
  questions: LeadFormQuestionT[]
}

// A fresh object per call, never a shared singleton: both fields travel out to callers that
// persist them, so one mutated array would poison every later empty result.
const empty = (): LeadFormT => ({ questions: [] })

/**
 * Fetch a form's name and questions (`GET /{form_id}?fields=name,questions`) — one call, because
 * the webhook needs both: the questions carry Meta's field types for normalizeLead and the
 * key→label map the answers modal renders, and the name is what the lead stores as its form.
 *
 * Best-effort: any failure (network, bad shape, missing formId) returns empties rather than
 * throwing — a missing label just degrades the modal to a cleaned-up key; it must never block
 * lead capture.
 */
export async function fetchForm(formId: string | undefined): Promise<LeadFormT> {
  if (!formId) return empty()
  try {
    const url = `https://graph.facebook.com/v21.0/${formId}?fields=name,questions`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${serverEnv.META_PAGE_ACCESS_TOKEN}` },
    })
    const parsed = formResponseSchema.safeParse(await res.json())
    if (!parsed.success) return empty()
    return { name: parsed.data.name, questions: toLeadFormQuestions(parsed.data.questions) }
  } catch {
    return empty()
  }
}
