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
 * One call for both name and questions: normalizeLead needs Meta's field types, the answers modal
 * needs the label map. Best-effort — any failure returns empties instead of throwing, since lead
 * capture must never block on it.
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
