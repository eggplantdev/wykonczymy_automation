import { describe, expect, it } from 'vitest'
import { protocolFormDefaults } from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'
import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'

const TODAY = '2026-09-28'

describe('protocolFormDefaults', () => {
  it('prefills odbiór końcowy, the osoba kontaktowa, the address and today on both dates', () => {
    const form = protocolFormDefaults({
      investment: investment({ contactPerson: 'Anna Nowak' }),
      today: TODAY,
    })

    expect(form).toEqual({
      kind: 'final',
      place: 'Warszawa',
      issueDate: TODAY,
      acceptanceDate: TODAY,
      readinessDate: '',
      clientName: 'Anna Nowak',
      contractorName: 'Wykończymy sp. z o. o.',
      siteAddress: 'ul. Kwiatowa 1/2, Kraków',
      paymentDueDate: '',
    })
  })

  it('falls back to the investment name when the osoba kontaktowa is blank', () => {
    const form = protocolFormDefaults({
      investment: investment({ contactPerson: '   ' }),
      today: TODAY,
    })

    expect(form.clientName).toBe('Jan Testowy Kwiatowa 1/2')
  })

  it('prefers the Zamawiający from „Dane do umowy” over the osoba kontaktowa', () => {
    const form = protocolFormDefaults({
      investment: investment({
        contactPerson: 'Anna Nowak',
        billing: {
          ...NO_INVESTMENT_BILLING,
          clientType: 'company',
          companyName: 'Firma Testowa sp. z o.o.',
          nip: '1234567890',
        },
      }),
      today: TODAY,
    })

    expect(form.clientName).toBe('Firma Testowa sp. z o.o., NIP 1234567890')
  })

  it('joins the structured site address and takes Miejscowość from it', () => {
    const form = protocolFormDefaults({
      investment: investment({
        address: 'Mirabelki 5/93',
        postalCode: '03-034',
        city: 'Kraków',
        country: 'Polska',
      }),
      today: TODAY,
    })

    expect(form.siteAddress).toBe('Mirabelki 5/93, 03-034 Kraków, Polska')
    expect(form.place).toBe('Kraków')
  })
})
