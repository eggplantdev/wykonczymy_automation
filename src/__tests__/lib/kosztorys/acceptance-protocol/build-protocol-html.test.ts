import { describe, expect, it } from 'vitest'
import { buildProtocolHtml } from '@/lib/kosztorys/acceptance-protocol/build-protocol-html'
import type {
  AcceptanceProtocolFormT,
  ProtocolSettlementT,
} from '@/lib/kosztorys/acceptance-protocol/types'

const FORM: AcceptanceProtocolFormT = {
  kind: 'final',
  place: 'Kraków',
  issueDate: '2026-09-28',
  acceptanceDate: '2026-09-27',
  readinessDate: '',
  clientName: 'Anna <b>Nowak</b>',
  contractorName: 'Wykończymy',
  siteAddress: 'ul. Kwiatowa 1/2',
  paymentDueDate: '',
}

const SETTLEMENT: ProtocolSettlementT = {
  laborCostsNet: 12000,
  discountNet: 0,
  materialsNet: 1300,
  totalNet: 13300,
  paidNet: 7000,
  lossNet: 0,
  remainingNet: 6300,
  isOverpaid: false,
}

const build = (overrides: Partial<Parameters<typeof buildProtocolHtml>[0]> = {}) =>
  buildProtocolHtml({
    form: FORM,
    scope: [
      { description: 'Płytki & fugi', qty: 12.5, unit: 'm2' },
      { description: 'Gładź', qty: 30, unit: '' },
    ],
    settlement: SETTLEMENT,
    logoUrl: 'https://app.test/logo-wykonczymy.png',
    ...overrides,
  })

const normalize = (html: string) => html.replace(/\u00a0|\u202f/g, ' ')

describe('buildProtocolHtml', () => {
  it('ticks the chosen rodzaj odbioru and nothing else', () => {
    const html = build()

    expect(html.match(/class="box checked"/g)).toHaveLength(1)
    expect(html).toMatch(/class="box checked">✕<\/span><span>odbiór końcowy,/)
  })

  it('escapes the owner’s text', () => {
    const html = build()

    expect(html).toContain('Anna &lt;b&gt;Nowak&lt;/b&gt;')
    expect(html).not.toContain('<b>Nowak</b>')
    expect(html).toContain('Płytki &amp; fugi')
  })

  it('lists the zakres with its quantity and j.m., numbered', () => {
    const html = build()

    expect(html).toContain('<tr><td>1</td><td>Płytki &amp; fugi</td><td>12,5 m2</td></tr>')
    expect(html).toContain('<tr><td>2</td><td>Gładź</td><td>30</td></tr>')
  })

  it('prints dates as dd.mm.yyyy and an empty field as a bare line to write on', () => {
    const html = build()

    expect(html).toContain('<span class="fill">Kraków, 28.09.2026</span>')
    expect(html).toContain('Data zgłoszenia gotowości do odbioru</span><span class="fill"></span>')
    expect(html).toContain(
      'Okres rękojmi i gwarancji liczy się od dnia</span><span class="fill">27.09.2026</span>',
    )
  })

  it('prints the wykonawca as the owner left it in the form', () => {
    const html = build({ form: { ...FORM, contractorName: 'Usługi Remontowe Kowal' } })

    expect(html).toContain('<span class="fill">Usługi Remontowe Kowal</span>')
  })

  it('prints the settlement steps netto, with strata only when there is one', () => {
    const html = normalize(build())

    expect(html).toContain('<td>Wpłaty</td><td class="num">-7000,00 zł</td>')
    expect(html).toContain('<td>Pozostało do zapłaty</td><td class="num">6300,00 zł</td>')
    expect(html).not.toContain('Strata')

    const withLoss = normalize(build({ settlement: { ...SETTLEMENT, lossNet: 150 } }))
    expect(withLoss).toContain('<td>Strata</td><td class="num">-150,00 zł</td>')
  })

  it('renames the last step to „Nadpłata" when the client has overpaid', () => {
    const html = build({
      settlement: { ...SETTLEMENT, remainingNet: -500, isOverpaid: true },
    })

    expect(html).toContain('<td>Nadpłata</td>')
    expect(html).not.toContain('Pozostało do zapłaty')
  })
})
