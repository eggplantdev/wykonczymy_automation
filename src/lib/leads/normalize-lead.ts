import type { LeadFieldT } from './lead-schema'

export type NormalizedLeadT = {
  email?: string
  name?: string
  phone?: string
  rawData: LeadFieldT[]
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/

// Meta's standard-field keys
// are localized/custom per form (`adres_e-mail`, `full name`), so we match on a
// substring of the key rather than an exact set — generalises to the next form.
const EMAIL_KEY_RE = /mail/i
const PHONE_KEY_RE = /phone|telefon|\btel\b/i
const NAME_KEY_RE = /name|imi[eę]|nazwisko/i

const firstValue = (field: LeadFieldT | undefined): string | undefined => field?.values?.[0]

export function normalizeLead(
  fieldData: LeadFieldT[],
  questions?: readonly { key: string; type?: string }[],
): NormalizedLeadT {
  const typeByKey = new Map((questions ?? []).map((question) => [question.key, question.type]))

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

  for (const field of fieldData) {
    const value = firstValue(field)
    if (value === undefined) continue
    const key = field.name
    if (email === undefined && EMAIL_KEY_RE.test(key) && EMAIL_RE.test(value)) email = value
    if (phone === undefined && PHONE_KEY_RE.test(key)) phone = value
    if (name === undefined && NAME_KEY_RE.test(key)) name = value
  }

  if (email === undefined) {
    for (const field of fieldData) {
      const match = firstValue(field)?.match(EMAIL_RE)
      if (match) {
        email = match[0]
        break
      }
    }
  }

  return { email, name, phone, rawData: fieldData }
}
