import { describe, it, expect } from 'vitest'
import { wpformsToStoreLeadInput, type WpformsSubmissionT } from '@/lib/leads/wpforms'

const SUBMITTED_AT = '2026-07-09T09:16:32.000Z'

// Mirrors the real "/kontakt" form (id 1686) shape — fields keyed by id, each
// { name(=label), value, type } — with all PII fabricated. Only the email field
// carries a semantic `type`; name/phone are plain text, identified by label.
function submission(overrides: Partial<WpformsSubmissionT> = {}): WpformsSubmissionT {
  return {
    form_id: '1686',
    form_name: '/kontakt',
    entry_id: 351,
    fields: {
      '1': { name: 'Adres e-mail', value: 'jan.kowalski@example.com', type: 'email' },
      '2': { name: 'Wiadomość', value: 'Dzień dobry', type: 'textarea' },
      '4': { name: 'Imię i nazwisko', value: 'Jan Kowalski', type: 'text' },
      '6': { name: 'Telefon', value: '+48500600700', type: 'text' },
      '12': { name: 'Zakres prac', value: 'remont', type: 'select' },
      '13': { name: 'Metraż prac', value: '30 - 60m²', type: 'select' },
    },
    ...overrides,
  }
}

describe('wpformsToStoreLeadInput', () => {
  it('tags the lead as the website_form source', () => {
    expect(wpformsToStoreLeadInput(submission(), SUBMITTED_AT).source).toBe('website_form')
  })

  it('extracts email / name / phone via the shared label heuristics', () => {
    const input = wpformsToStoreLeadInput(submission(), SUBMITTED_AT)
    expect(input.email).toBe('jan.kowalski@example.com')
    expect(input.name).toBe('Jan Kowalski')
    expect(input.phone).toBe('+48500600700')
  })

  it('keys rawData and formQuestions by label so the answers modal renders every field', () => {
    const input = wpformsToStoreLeadInput(submission(), SUBMITTED_AT)
    // Every submitted field survives in rawData, keyed by its label.
    expect(input.rawData).toContainEqual({ name: 'Zakres prac', values: ['remont'] })
    expect(input.rawData).toContainEqual({ name: 'Metraż prac', values: ['30 - 60m²'] })
    expect(input.rawData).toHaveLength(6)
    // formQuestions mirrors the keys and carries the WPForms type.
    expect(input.formQuestions).toContainEqual({
      key: 'Zakres prac',
      label: 'Zakres prac',
      type: 'select',
    })
  })

  it('uses a positive entry_id as the externalId for idempotent dedup', () => {
    expect(wpformsToStoreLeadInput(submission({ entry_id: 351 }), SUBMITTED_AT).externalId).toBe(
      '351',
    )
  })

  // The collision guard: WPForms Lite installs without stored entries send 0. If
  // 0 became externalId "0", every such lead would dedup into a single row. It
  // must degrade to "no id" so each submission creates instead.
  it('treats entry_id 0 as no externalId (never collides on "0")', () => {
    expect(
      wpformsToStoreLeadInput(submission({ entry_id: 0 }), SUBMITTED_AT).externalId,
    ).toBeUndefined()
  })

  it('treats a missing entry_id as no externalId', () => {
    expect(
      wpformsToStoreLeadInput(submission({ entry_id: undefined }), SUBMITTED_AT).externalId,
    ).toBeUndefined()
  })

  it('coerces a numeric field value to a string', () => {
    const input = wpformsToStoreLeadInput(
      submission({ fields: { '6': { name: 'Telefon', value: 511833686, type: 'text' } } }),
      SUBMITTED_AT,
    )
    expect(input.rawData).toContainEqual({ name: 'Telefon', values: ['511833686'] })
  })

  it('carries form identity and the caller-supplied submittedAt through', () => {
    const input = wpformsToStoreLeadInput(submission(), SUBMITTED_AT)
    expect(input.formId).toBe('1686')
    expect(input.formName).toBe('/kontakt')
    expect(input.submittedAt).toBe(SUBMITTED_AT)
  })

  it('returns an emailless input without throwing when no email field is present', () => {
    const input = wpformsToStoreLeadInput(
      submission({
        fields: { '4': { name: 'Imię i nazwisko', value: 'Jan Kowalski', type: 'text' } },
      }),
      SUBMITTED_AT,
    )
    expect(input.email).toBeUndefined()
    expect(input.name).toBe('Jan Kowalski')
  })
})
