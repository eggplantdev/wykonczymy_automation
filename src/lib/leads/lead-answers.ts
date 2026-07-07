import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'

export type LeadAnswerT = { label: string; value: string }

// Fallback when a field has no label in the form's question map (e.g. a lead
// captured before formQuestions existed): turn the raw key into something readable.
const humanizeKey = (key: string): string => key.replace(/[_-]+/g, ' ').trim()

/**
 * Join raw answers (`rawData`, `{name, values}`) with the form's key→label map
 * (`formQuestions`) into display-ready `{ label, value }` pairs, in submission
 * order. Missing label → cleaned-up key; empty answers are dropped.
 */
export function buildLeadAnswers(
  rawData: LeadFieldT[] | undefined,
  formQuestions: LeadFormQuestionT[] | undefined,
): LeadAnswerT[] {
  const labelByKey = new Map(
    (formQuestions ?? []).map((question) => [question.key, question.label]),
  )

  return (rawData ?? []).flatMap((field) => {
    const value = field.values?.join(', ').trim()
    if (!value) return []
    return [{ label: labelByKey.get(field.name) ?? humanizeKey(field.name), value }]
  })
}
