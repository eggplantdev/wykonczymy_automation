import { describe, expect, it } from 'vitest'
import { protocolFormDefaults } from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { investment } from '@/__tests__/lib/kosztorys/acceptance-protocol/fixtures'

const TODAY = '2026-09-28'

describe('protocolFormDefaults', () => {
  it('prefills the osoba kontaktowa, the address and today on both dates', () => {
    const form = protocolFormDefaults({
      investment: investment({ contactPerson: 'Anna Nowak' }),
      rows: [],
      stages: CTX.stages,
      today: TODAY,
    })

    expect(form).toEqual({
      kind: 'partial',
      place: '',
      issueDate: TODAY,
      acceptanceDate: TODAY,
      readinessDate: '',
      clientName: 'Anna Nowak',
      siteAddress: 'ul. Kwiatowa 1/2, Kraków',
      paymentDueDate: '',
    })
  })

  it('falls back to the investment name when the osoba kontaktowa is blank', () => {
    const form = protocolFormDefaults({
      investment: investment({ contactPerson: '   ' }),
      rows: [],
      stages: CTX.stages,
      today: TODAY,
    })

    expect(form.clientName).toBe('Jan Testowy Kwiatowa 1/2')
  })

  it('guesses „końcowy" once every przedmiar is fully executed', () => {
    const rows = [
      row({ id: 1, plannedQty: 10, [stageKey(1)]: 6, [stageKey(2)]: 4 }),
      row({ id: 2, plannedQty: 5, [stageKey(1)]: 7 }),
      // No przedmiar: work beyond the offer does not decide the kind either way.
      row({ id: 3, plannedQty: 0 }),
    ]

    const form = protocolFormDefaults({
      investment: investment(),
      rows,
      stages: CTX.stages,
      today: TODAY,
    })

    expect(form.kind).toBe('final')
  })

  it('guesses „częściowy" while any przedmiar is short', () => {
    const rows = [
      row({ id: 1, plannedQty: 10, [stageKey(1)]: 10 }),
      row({ id: 2, plannedQty: 5, [stageKey(1)]: 4.99 }),
    ]

    const form = protocolFormDefaults({
      investment: investment(),
      rows,
      stages: CTX.stages,
      today: TODAY,
    })

    expect(form.kind).toBe('partial')
  })

  it('guesses „częściowy" on a kosztorys with no przedmiar at all', () => {
    const rows = [row({ plannedQty: 0, [stageKey(1)]: 3 })]

    const form = protocolFormDefaults({
      investment: investment(),
      rows,
      stages: CTX.stages,
      today: TODAY,
    })

    expect(form.kind).toBe('partial')
  })
})
