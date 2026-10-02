import { describe, expect, it } from 'vitest'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'

const FULL = {
  address: 'ul. Testowa 1',
  phone: '500600700',
  email: 'test@example.com',
  contactPerson: 'Jan Testowy',
  notes: 'Notatka',
  status: 'active' as const,
}

describe('buildInvestmentInfoFields', () => {
  it('zwraca komplet pól, gdy wszystkie są wypełnione', () => {
    const fields = buildInvestmentInfoFields(FULL)
    expect(fields.map((field) => field.label)).toEqual([
      'Adres',
      'Telefon',
      'Email',
      'Osoba kontaktowa',
      'Notatki',
      'Status',
    ])
  })

  // Regression guard: `Telefon`/`Email` wrap the raw value in `<ContactLink>`, which is always
  // truthy — filtering on the rendered node instead of the raw field silently kept an empty phone
  // or email in the list.
  it('odfiltrowuje puste Telefon i Email, zostawia resztę', () => {
    const fields = buildInvestmentInfoFields({ ...FULL, phone: '', email: '' })
    expect(fields.map((field) => field.label)).toEqual([
      'Adres',
      'Osoba kontaktowa',
      'Notatki',
      'Status',
    ])
  })

  it('Status zostaje nawet gdy wszystkie pozostałe pola są puste', () => {
    const fields = buildInvestmentInfoFields({
      address: '',
      phone: '',
      email: '',
      contactPerson: '',
      notes: '',
      status: 'planowana',
    })
    expect(fields.map((field) => field.label)).toEqual(['Status'])
  })
})
