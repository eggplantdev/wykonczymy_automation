import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'
import type { LeadAnswerT } from '@/types/leads'

const humanizeKey = (key: string): string => key.replace(/[_-]+/g, ' ').trim()

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
