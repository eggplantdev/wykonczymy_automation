import type { LeadFieldT } from './lead-schema'

export type LeadQuestionT = { key: string; type: string }

export type NormalizedLeadT = {
  email?: string
  name?: string
  phone?: string
  rawData: LeadFieldT[]
  isTest: boolean
}

const TEST_LEAD_PREFIX = '<test lead:'
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/

const firstValue = (field: LeadFieldT | undefined): string | undefined => field?.values?.[0]

/**
 * Map raw Meta `field_data` → typed columns + the untouched raw array.
 *
 * Primary path: resolve each field's Meta type from the form `questions`
 * (EMAIL / PHONE / FULL_NAME are Meta-validated and safe to lift). Fallback,
 * when questions are absent: recover an email via regex on the values. CUSTOM
 * free-text fields are never promoted — they live only in `rawData`.
 */
export function normalizeLead(
  fieldData: LeadFieldT[],
  questions?: LeadQuestionT[],
): NormalizedLeadT {
  const typeByKey = new Map((questions ?? []).map((q) => [q.key, q.type]))
  const isTest = fieldData.some((f) => firstValue(f)?.startsWith(TEST_LEAD_PREFIX) ?? false)

  let email: string | undefined
  let name: string | undefined
  let phone: string | undefined

  for (const field of fieldData) {
    const value = firstValue(field)
    if (value === undefined) continue
    switch (typeByKey.get(field.name)) {
      case 'EMAIL':
        email ??= value
        break
      case 'PHONE':
        phone ??= value
        break
      case 'FULL_NAME':
        name ??= value
        break
    }
  }

  // Fallback: no typed email found (e.g. questions unavailable) — scan values.
  if (email === undefined) {
    for (const field of fieldData) {
      const match = firstValue(field)?.match(EMAIL_RE)
      if (match) {
        email = match[0]
        break
      }
    }
  }

  return { email, name, phone, rawData: fieldData, isTest }
}
