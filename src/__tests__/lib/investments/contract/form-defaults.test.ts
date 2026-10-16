import { describe, expect, it } from 'vitest'
import { contractFormDefaults, contractPrefillKey } from '@/lib/investments/contract/form-defaults'
import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'

const TODAY = '2026-10-16'

const site = {
  address: 'Mirabelki 5/93',
  postalCode: '03-034',
  city: 'Warszawa',
  country: '',
}

describe('contractFormDefaults', () => {
  it('prefills an Osoba prywatna with the site address when „taki sam” is on', () => {
    const form = contractFormDefaults({
      investment: investment({
        ...site,
        billing: {
          ...NO_INVESTMENT_BILLING,
          clientType: 'person',
          firstName: 'Anna',
          lastName: 'Nowak',
        },
      }),
      today: TODAY,
      plannedNet: 45678.9,
    })

    expect(form).toEqual({
      number: '',
      signDate: TODAY,
      place: 'Warszawie',
      clientName: 'Anna Nowak',
      clientPesel: '',
      clientAddress: 'Mirabelki 5/93, 03-034 Warszawa',
      siteAddress: 'Mirabelki 5/93, 03-034 Warszawa',
      startWindow: '',
      duration: '',
      supervisors: 'Bartosz Antonik, Yuri Abramenko',
      plannedNet: expect.stringMatching(/^45\s678,90$/),
      isCompany: false,
    })
  })

  it('names a Firma with its NIP and representative and takes the billing address', () => {
    const form = contractFormDefaults({
      investment: investment({
        ...site,
        billing: {
          ...NO_INVESTMENT_BILLING,
          clientType: 'company',
          companyName: 'Firma Testowa sp. z o.o.',
          nip: '1234567890',
          representative: 'Jan Kowalski',
          sameAsSite: false,
          street: 'Polna 3',
          postalCode: '00-001',
          city: 'Kraków',
        },
      }),
      today: TODAY,
      plannedNet: 1000,
    })

    expect(form.clientName).toBe('Firma Testowa sp. z o.o., NIP 1234567890, repr. Jan Kowalski')
    expect(form.clientAddress).toBe('Polna 3, 00-001 Kraków')
    expect(form.siteAddress).toBe('Mirabelki 5/93, 03-034 Warszawa')
    expect(form.isCompany).toBe(true)
  })

  it('falls back to the osoba kontaktowa without „Dane do umowy”', () => {
    const form = contractFormDefaults({
      investment: investment({ contactPerson: 'Ewa Zielińska' }),
      today: TODAY,
      plannedNet: 1000,
    })

    expect(form.clientName).toBe('Ewa Zielińska')
  })

  it.each([
    ['no kosztorys figure', undefined],
    ['an empty przedmiar', 0],
  ])('leaves the amount blank for %s', (_, plannedNet) => {
    const form = contractFormDefaults({ investment: investment(), today: TODAY, plannedNet })

    expect(form.plannedNet).toBe('')
  })
})

describe('contractPrefillKey', () => {
  it('changes when the client type flips, so the PESEL field remounts', () => {
    const person = investment({
      billing: { ...NO_INVESTMENT_BILLING, clientType: 'person', firstName: 'Anna' },
    })
    const company = investment({
      billing: { ...NO_INVESTMENT_BILLING, clientType: 'company', companyName: 'Anna' },
    })

    expect(contractPrefillKey(person)).not.toBe(contractPrefillKey(company))
  })
})
