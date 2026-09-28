import { describe, expect, it } from 'vitest'
import {
  hasInvestmentChanges,
  investmentUpdateFromProtocol,
} from '@/lib/kosztorys/acceptance-protocol/investment-update'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'

describe('investmentUpdateFromProtocol', () => {
  it('writes only the osoba kontaktowa and the address', () => {
    const payload = investmentUpdateFromProtocol(investment({ status: 'completed' }), {
      clientName: '  Anna Nowak ',
      siteAddress: 'ul. Nowa 5, Kraków',
    })

    expect(payload).toEqual({ contactPerson: 'Anna Nowak', address: 'ul. Nowa 5, Kraków' })
  })

  it('keeps a blank osoba kontaktowa blank when only the address was edited', () => {
    const inv = investment({ contactPerson: '' })

    const payload = investmentUpdateFromProtocol(inv, {
      clientName: inv.name,
      siteAddress: 'ul. Nowa 5, Kraków',
    })

    expect(payload.contactPerson).toBe('')
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
