import { describe, it, expect } from 'vitest'
import { normalizeLead } from '@/lib/leads/normalize-lead'

// Mirrors form 899352536400611 ("komercyjnie - wwa - cold | 26") — see docs/facebook-leads-setup.md.
const questions = [
  { key: 'z_jakiej_dzielnicy_warszawy_jesteś?', type: 'CUSTOM' },
  { key: 'jakie_pomieszczenie_chcesz_wyremontować?', type: 'CUSTOM' },
  { key: 'full name', type: 'FULL_NAME' },
  { key: 'phone_number', type: 'PHONE' },
  { key: 'adres_e-mail', type: 'EMAIL' },
]

// Synthetic submission (fabricated PII). Field order deliberately shuffled —
// Meta does not fix it. Shape mirrors form 899352536400611, values invented.
const realFieldData = [
  { name: 'jakie_pomieszczenie_chcesz_wyremontować?', values: ['Lazienka / WC'] },
  { name: 'full name', values: ['Anna Nowak'] },
  { name: 'z_jakiej_dzielnicy_warszawy_jesteś?', values: ['Bemowo'] },
  { name: 'phone_number', values: ['+48500600700'] },
  { name: 'adres_e-mail', values: ['anna.nowak@example.com'] },
]

describe('normalizeLead', () => {
  it('lifts email / phone / name by Meta field type', () => {
    const r = normalizeLead(realFieldData, questions)
    expect(r.email).toBe('anna.nowak@example.com')
    expect(r.phone).toBe('+48500600700')
    expect(r.name).toBe('Anna Nowak')
  })

  it('keeps CUSTOM fields only in rawData, never promoted to a column', () => {
    const r = normalizeLead(realFieldData, questions)
    expect(r.name).not.toContain('Bemowo')
    expect(r.rawData).toEqual(realFieldData)
  })

  // Webhook path: the per-lead payload has no field type, so we key off the field name.
  it('lifts email / phone / name by known key when no questions are provided', () => {
    const r = normalizeLead(realFieldData)
    expect(r.email).toBe('anna.nowak@example.com')
    expect(r.phone).toBe('+48500600700')
    expect(r.name).toBe('Anna Nowak')
  })

  it('does not promote a CUSTOM field via the key heuristic', () => {
    const r = normalizeLead(realFieldData)
    expect(r.name).not.toContain('Bemowo')
    expect(r.phone).not.toContain('Lazienka')
  })

  it('ignores a mail-ish key whose value is not an email (regex still recovers the real one)', () => {
    const r = normalizeLead([
      { name: 'kod_mailingowy', values: ['PROMO2026'] },
      { name: 'kontakt', values: ['anna.nowak@example.com'] },
    ])
    expect(r.email).toBe('anna.nowak@example.com')
  })

  it('falls back to an email regex on values when the key is unrecognised', () => {
    const r = normalizeLead([{ name: 'kontakt', values: ['anna.nowak@example.com'] }])
    expect(r.email).toBe('anna.nowak@example.com')
  })

  it('handles values as an array (never assumes a scalar)', () => {
    const r = normalizeLead([{ name: 'adres_e-mail', values: ['a@b.pl', 'ignored'] }], questions)
    expect(r.email).toBe('a@b.pl')
  })

  it('returns an emailless result without throwing when no email is present', () => {
    const r = normalizeLead(
      [
        { name: 'full name', values: ['Jan Kowalski'] },
        { name: 'phone_number', values: ['+48123456789'] },
      ],
      questions,
    )
    expect(r.email).toBeUndefined()
    expect(r.name).toBe('Jan Kowalski')
    expect(r.phone).toBe('+48123456789')
    expect(r.rawData).toHaveLength(2)
  })

  it('ignores an empty values array without throwing', () => {
    const r = normalizeLead([{ name: 'full name', values: [] }], questions)
    expect(r.name).toBeUndefined()
  })
})
