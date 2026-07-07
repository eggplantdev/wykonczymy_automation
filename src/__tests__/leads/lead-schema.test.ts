import { describe, it, expect } from 'vitest'
import { leadSchema } from '@/lib/leads/lead-schema'

// All values fabricated — no real leadgen ids, names, or emails.
const goodLead = {
  id: '1000000000000001',
  created_time: '2026-07-05T18:48:40+0000',
  form_id: '899352536400611',
  field_data: [
    { name: 'full name', values: ['Anna Nowak'] },
    { name: 'adres_e-mail', values: ['anna.nowak@example.com'] },
  ],
}

describe('leadSchema', () => {
  it('parses a well-formed Graph API lead', () => {
    const result = leadSchema.safeParse(goodLead)
    expect(result.success).toBe(true)
  })

  it('parses a lead without the optional form_id', () => {
    const { form_id: _omit, ...noForm } = goodLead
    expect(leadSchema.safeParse(noForm).success).toBe(true)
  })

  it('fails when field_data is missing', () => {
    const { field_data: _omit, ...noFields } = goodLead
    expect(leadSchema.safeParse(noFields).success).toBe(false)
  })

  it('fails when values is not an array of strings', () => {
    const bad = { ...goodLead, field_data: [{ name: 'full name', values: 'not-an-array' }] }
    expect(leadSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when id is absent', () => {
    const { id: _omit, ...noId } = goodLead
    expect(leadSchema.safeParse(noId).success).toBe(false)
  })
})
