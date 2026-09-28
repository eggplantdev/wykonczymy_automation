import { describe, expect, it } from 'vitest'
import { protocolFormDefaults } from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'

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
})
