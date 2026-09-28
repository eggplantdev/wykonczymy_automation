import { describe, expect, it } from 'vitest'
import { protocolScopeRows } from '@/lib/kosztorys/acceptance-protocol/scope-rows'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

describe('protocolScopeRows', () => {
  it('keeps only pozycje some etap executed, with the stage sum as the quantity, in kosztorys order', () => {
    const rows = [
      row({ id: 1, description: 'Gładzie', stage_1: 10, stage_2: 5 }),
      row({ id: 2, description: 'Nietknięte' }),
      row({ id: 3, description: 'Fugi', unit: 'mb', stage_2: 2.5 }),
    ]

    expect(protocolScopeRows(rows, CTX.stages)).toEqual([
      { sectionName: 'Podłogi', description: 'Gładzie', qty: 15, unit: 'm2' },
      { sectionName: 'Podłogi', description: 'Fugi', qty: 2.5, unit: 'mb' },
    ])
  })

  it('prints a missing opis or j.m. as an empty string', () => {
    const rows = [row({ description: null, unit: null, stage_1: 1 })]

    expect(protocolScopeRows(rows, CTX.stages)).toEqual([
      { sectionName: 'Podłogi', description: '', qty: 1, unit: '' },
    ])
  })
})
