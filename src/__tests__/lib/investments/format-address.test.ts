import { describe, expect, it } from 'vitest'
import {
  formatAddress,
  formatBillingAddress,
  formatBillingParty,
} from '@/lib/investments/format-address'
import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'

const BLANK_BILLING = NO_INVESTMENT_BILLING

describe('formatAddress', () => {
  it('joins street, postal code with city, and country', () => {
    expect(
      formatAddress({
        street: 'ul. Lipowa 3/5',
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'Polska',
      }),
    ).toBe('ul. Lipowa 3/5, 00-001 Warszawa, Polska')
  })

  it('skips blank parts without leaving dangling separators', () => {
    expect(formatAddress({ street: '', postalCode: '', city: 'Kraków', country: '' })).toBe(
      'Kraków',
    )
    expect(formatAddress({ street: 'Lipowa 3', postalCode: '00-001', city: '', country: '' })).toBe(
      'Lipowa 3, 00-001',
    )
    expect(formatAddress({ street: '', postalCode: '', city: '', country: '' })).toBe('')
  })
})

describe('formatBillingParty', () => {
  it('renders a private person as first and last name', () => {
    expect(
      formatBillingParty({
        ...BLANK_BILLING,
        clientType: 'person',
        firstName: 'Anna',
        lastName: 'Nowak',
      }),
    ).toBe('Anna Nowak')
  })

  it('renders a company with NIP and its representative', () => {
    expect(
      formatBillingParty({
        ...BLANK_BILLING,
        clientType: 'company',
        companyName: 'Firma Testowa sp. z o.o.',
        nip: '1234567890',
        representative: 'Jan Kowalski',
      }),
    ).toBe('Firma Testowa sp. z o.o., NIP 1234567890, repr. Jan Kowalski')
  })

  it('ignores the other type’s fields and an unset type', () => {
    expect(
      formatBillingParty({
        ...BLANK_BILLING,
        clientType: 'company',
        firstName: 'Anna',
        companyName: 'Firma',
      }),
    ).toBe('Firma')
    expect(formatBillingParty({ ...BLANK_BILLING, firstName: 'Anna' })).toBe('')
  })
})

describe('formatBillingAddress', () => {
  const own = {
    ...BLANK_BILLING,
    street: 'Polna 1',
    postalCode: '30-001',
    city: 'Kraków',
  }

  it('is empty while the billing address follows the site', () => {
    expect(formatBillingAddress({ ...own, sameAsSite: true })).toBe('')
  })

  it('formats its own address once unticked', () => {
    expect(formatBillingAddress({ ...own, sameAsSite: false })).toBe('Polna 1, 30-001 Kraków')
  })
})
