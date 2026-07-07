import { serverEnv } from '@/lib/env.server'
import { formQuestionsResponseSchema, type LeadFormQuestionT } from './lead-schema'

/**
 * Fetch a form's questions (`GET /{form_id}?fields=questions`) to persist the
 * key→label map alongside the lead, so raw answers can render as real questions.
 *
 * Best-effort: any failure (network, bad shape, missing formId) returns [] rather
 * than throwing — a missing label just degrades the modal to a cleaned-up key; it
 * must never block lead capture.
 */
export async function fetchFormQuestions(formId: string | undefined): Promise<LeadFormQuestionT[]> {
  if (!formId) return []
  try {
    const url = `https://graph.facebook.com/v21.0/${formId}?fields=questions&access_token=${serverEnv.META_PAGE_ACCESS_TOKEN}`
    const res = await fetch(url)
    const parsed = formQuestionsResponseSchema.safeParse(await res.json())
    if (!parsed.success) return []
    return (parsed.data.questions ?? [])
      .filter((question) => question.label)
      .map((question) => ({ key: question.key, label: question.label as string }))
  } catch {
    return []
  }
}
