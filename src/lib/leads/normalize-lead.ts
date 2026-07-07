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

// Key heuristics for the webhook path, where the per-lead payload carries no field
// type (type lives on the form definition, not the lead). Meta's standard-field keys
// are localized/custom per form (`adres_e-mail`, `full name`), so we match on a
// substring of the key rather than an exact set — generalises to the next form.
const EMAIL_KEY_RE = /mail/i
const PHONE_KEY_RE = /phone|telefon|\btel\b/i
const NAME_KEY_RE = /name|imi[eę]|nazwisko/i

const firstValue = (field: LeadFieldT | undefined): string | undefined => field?.values?.[0]

/**
 * Map raw Meta `field_data` → typed columns + the untouched raw array.
 *
 * Precedence, most→least reliable:
 *   1. Meta field **type** from the form `questions` (EMAIL / PHONE / FULL_NAME) —
 *      Meta-validated, used when a type-map is supplied.
 *   2. **Key heuristic** — the webhook has no type-map, so match on the field key
 *      (`/mail/`, `/phone/`, `/name|imię|nazwisko/`); email is value-checked so a
 *      stray `/mail/` key can't mislabel.
 *   3. **Email regex** over all values — last resort.
 * CUSTOM free-text fields never match, so they live only in `rawData`.
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

  // 1. Type-map pass.
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

  // 2. Key-heuristic pass — fills only what the type-map didn't.
  for (const field of fieldData) {
    const value = firstValue(field)
    if (value === undefined) continue
    const key = field.name
    if (email === undefined && EMAIL_KEY_RE.test(key) && EMAIL_RE.test(value)) email = value
    if (phone === undefined && PHONE_KEY_RE.test(key)) phone = value
    if (name === undefined && NAME_KEY_RE.test(key)) name = value
  }

  // 3. Email regex over any value — last resort.
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
