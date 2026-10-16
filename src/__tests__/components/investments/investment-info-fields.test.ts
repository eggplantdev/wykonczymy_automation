import { describe, expect, it } from 'vitest'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'
import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'

const FULL = {
  id: 7,
  address: 'ul. Testowa 1',
  postalCode: '00-001',
  city: 'Warszawa',
  country: 'Polska',
  phone: '500600700',
  email: 'test@example.com',
  contactPerson: 'Jan Testowy',
  billing: {
    ...NO_INVESTMENT_BILLING,
    clientType: 'company' as const,
    companyName: 'Firma Testowa',
    sameAsSite: false,
    street: 'Polna 1',
    city: 'Kraków',
  },
  status: 'active' as const,
  reviewRequested: true,
  aiStage: null,
}

const BLANK_SITE = { postalCode: '', city: '', country: '', billing: NO_INVESTMENT_BILLING }

describe('buildInvestmentInfoFields', () => {
  it('zwraca komplet pól, gdy wszystkie są wypełnione', () => {
    const fields = buildInvestmentInfoFields(FULL)
    expect(fields.map((field) => field.label)).toEqual([
      'Adres',
      'Telefon',
      'Email',
      'Osoba kontaktowa',
      'Zamawiający',
      'Adres do umowy',
      'Status',
      'Opinia',
      'Etap AI',
    ])
  })

  it('składa Adres z ulicy, kodu, miejscowości i kraju', () => {
    const address = buildInvestmentInfoFields(FULL).find((field) => field.label === 'Adres')
    expect(address?.value).toBe('ul. Testowa 1, 00-001 Warszawa, Polska')
  })

  it('pomija Adres do umowy, gdy jest taki sam jak adres inwestycji', () => {
    const fields = buildInvestmentInfoFields({
      ...FULL,
      billing: { ...FULL.billing, sameAsSite: true },
    })
    expect(fields.map((field) => field.label)).toContain('Zamawiający')
    expect(fields.map((field) => field.label)).not.toContain('Adres do umowy')
  })

  // Regression guard: `Telefon`/`Email` wrap the raw value in `<ContactLink>`, which is always
  // truthy — filtering on the rendered node instead of the raw field silently kept an empty phone
  // or email in the list.
  it('odfiltrowuje puste Telefon i Email, zostawia resztę', () => {
    const fields = buildInvestmentInfoFields({
      ...FULL,
      ...BLANK_SITE,
      phone: '',
      email: '',
      reviewRequested: false,
    })
    expect(fields.map((field) => field.label)).toEqual([
      'Adres',
      'Osoba kontaktowa',
      'Status',
      'Etap AI',
    ])
  })

  it('Status zostaje nawet gdy wszystkie pozostałe pola są puste, a Etap AI znika w trybie tylko do odczytu', () => {
    const fields = buildInvestmentInfoFields(
      {
        id: 7,
        address: '',
        ...BLANK_SITE,
        phone: '',
        email: '',
        contactPerson: '',
        status: 'planowana',
        reviewRequested: false,
        aiStage: null,
      },
      { isReadOnly: true },
    )
    expect(fields.map((field) => field.label)).toEqual(['Status'])
  })
})
