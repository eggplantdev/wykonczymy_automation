import {
  INVESTMENT_INITIAL_INFO_FIELDS,
  INVESTMENT_INITIAL_INFO_TITLE,
} from '@/lib/constants/investment-initial-info'
import { lines } from './prod-client'

export type InitialInfoT = Record<string, string | null | undefined>

const EMPTY_VALUE = '— (puste)'

// A key the app has but this list doesn't yet still reaches the agent, raw.
export function initialInfoLines(initialInfo: InitialInfoT | null | undefined): string[] {
  const values = initialInfo ?? {}
  const fields: Record<
    string,
    { label: { pl: string }; options?: Record<string, { pl: string }> }
  > = INVESTMENT_INITIAL_INFO_FIELDS
  const known = Object.entries(fields).map(([key, field]) => {
    const value = values[key]
    return `${field.label.pl}: ${value ? (field.options?.[value]?.pl ?? value) : EMPTY_VALUE}`
  })
  const unknown = Object.entries(values)
    .filter(([key]) => !(key in fields))
    .map(([key, value]) => `${key}: ${value || EMPTY_VALUE}`)
  return [...known, ...unknown]
}

export const initialInfoMarkdown = (lines: readonly string[]) =>
  [`# ${INVESTMENT_INITIAL_INFO_TITLE.pl}`, '', ...lines].join('\n') + '\n'

export const parseInitialInfoMarkdown = (text: string) =>
  lines(text).filter((line) => !line.startsWith('#'))
