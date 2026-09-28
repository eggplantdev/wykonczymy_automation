import { describe, expect, it } from 'vitest'
import {
  hasInvestmentChanges,
  investmentUpdateFromProtocol,
} from '@/lib/kosztorys/acceptance-protocol/investment-update'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'

describe('investmentUpdateFromProtocol', () => {
  it('changes only the osoba kontaktowa and the address, carrying every other field through', () => {
    const payload = investmentUpdateFromProtocol(investment({ status: 'completed' }), {
      clientName: '  Anna Nowak ',
      siteAddress: 'ul. Nowa 5, Kraków',
    })

    expect(payload).toEqual({
      name: 'Jan Testowy Kwiatowa 1/2',
      address: 'ul. Nowa 5, Kraków',
      phone: '600 000 000',
      email: 'jan@example.test',
      contactPerson: 'Anna Nowak',
      notes: 'klucze u sąsiada',
      review: 'ok',
      status: 'completed',
      presetId: '',
    })
  })
})

describe('hasInvestmentChanges', () => {
  it('stays off for an untouched form seeded from the investment name', () => {
    const inv = investment({ contactPerson: '' })

    expect(
      hasInvestmentChanges(inv, { clientName: inv.name, siteAddress: ` ${inv.address} ` }),
    ).toBe(false)
  })

  it('turns on when Zamawiający or the address is edited', () => {
    const inv = investment({ contactPerson: 'Anna Nowak' })

    expect(
      hasInvestmentChanges(inv, { clientName: 'Anna Kowalska', siteAddress: inv.address }),
    ).toBe(true)
    expect(hasInvestmentChanges(inv, { clientName: 'Anna Nowak', siteAddress: 'inny' })).toBe(true)
  })
})
