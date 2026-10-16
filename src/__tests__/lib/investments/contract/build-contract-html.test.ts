import { describe, expect, it } from 'vitest'
import { buildContractHtml } from '@/lib/investments/contract/build-contract-html'
import type { ContractFormT } from '@/lib/investments/contract/types'

function contractForm(overrides: Partial<ContractFormT> = {}): ContractFormT {
  return {
    number: '2/10/2026',
    signDate: '2026-10-14',
    place: 'Warszawie',
    clientName: 'Anna Nowak',
    clientPesel: '90010112345',
    clientAddress: { street: 'Polna 3', postalCode: '00-001', city: 'Kraków', country: '' },
    siteAddress: { street: 'Mirabelki 5/93', postalCode: '03-034', city: 'Warszawa', country: '' },
    startWindow: '1 a 15 listopada',
    duration: '5 tygodni',
    supervisors: 'Bartosz Antonik, Yuri Abramenko',
    plannedNet: '45 678,90',
    isCompany: false,
    ...overrides,
  }
}

const fill = (value: string) => `<span class="fill">${value}</span>`

describe('buildContractHtml', () => {
  it('prints the number, date, client block and the fields inside the clauses', () => {
    const html = buildContractHtml({ form: contractForm() })

    expect(html).toContain(`UMOWA nr ${fill('2/10/2026')}`)
    expect(html).toContain(`zawarta w dniu ${fill('14.10.2026')} r. w ${fill('Warszawie')}`)
    expect(html).toContain(fill('90010112345'))
    expect(html).toContain(`<span>Adres</span>${fill('Polna 3, 00-001 Kraków')}`)
    expect(html).toContain('zwanym dalej (Zamawiającym)')
    expect(html).toContain(`zlokalizowany jest: ${fill('Mirabelki 5/93, 03-034 Warszawa')}.`)
    expect(html).toContain(
      `pomiędzy ${fill('1 a 15 listopada')} a prace będą trwały ${fill('5 tygodni')}.`,
    )
    expect(html).toContain(`Przyjmującego zamówienie: ${fill('Bartosz Antonik, Yuri Abramenko')}.`)
    expect(html).toContain(`netto około ${fill('45 678,90')} zł 8% VAT`)
  })

  it('carries the fixed company data', () => {
    const html = buildContractHtml({ form: contractForm() })

    expect(html).toContain('Wykończymy sp. z o.o.')
    expect(html).toContain('NIP 1182271075')
    expect(html).toContain('KRS 0001062152')
    expect(html).toContain('68 1140 2004 0000 3002 8445 4840')
    expect(html).toContain('<div>Zamawiający</div><div>Przyjmujący zamówienie</div>')
  })

  it('prints every empty field as a blank line for the pen', () => {
    const html = buildContractHtml({
      form: contractForm({
        number: '',
        signDate: '',
        clientPesel: '',
        startWindow: '',
        duration: '',
        plannedNet: '',
      }),
    })

    expect(html).toContain(`UMOWA nr ${fill('')}`)
    expect(html).toContain(`zawarta w dniu ${fill('')} r.`)
    expect(html).toContain(`<span>PESEL</span>${fill('')}`)
    expect(html).toContain(`pomiędzy ${fill('')} a prace będą trwały ${fill('')}.`)
    expect(html).toContain(`netto około ${fill('')} zł`)
  })

  it('drops the PESEL line for a company', () => {
    const html = buildContractHtml({ form: contractForm({ isCompany: true }) })

    expect(html).not.toContain('PESEL')
  })

  it('escapes what the user typed', () => {
    const html = buildContractHtml({
      form: contractForm({ clientName: '<b>Nowak</b>', duration: '"5" & więcej' }),
    })

    expect(html).toContain('&lt;b&gt;Nowak&lt;/b&gt;')
    expect(html).toContain(fill('&quot;5&quot; &amp; więcej'))
    expect(html).not.toContain('<b>Nowak</b>')
  })

  it('names the PDF after the number and the client', () => {
    expect(buildContractHtml({ form: contractForm() })).toContain(
      '<title>Umowa nr 2/10/2026 — Anna Nowak</title>',
    )
    expect(buildContractHtml({ form: contractForm({ number: '' }) })).toContain(
      '<title>Umowa — Anna Nowak</title>',
    )
  })

  it('carries none of the source PDF’s zero-width spaces', () => {
    expect(buildContractHtml({ form: contractForm() })).not.toContain('​')
  })
})
