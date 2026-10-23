import { describe, expect, it } from 'vitest'
import { scoreCases, shortPozycja, toCsv, type ScoredItemT } from '../../../../scripts/ai-kosztorys/accuracy'

const item = (overrides: Partial<ScoredItemT>): ScoredItemT => ({
  aiPlannedQty: 0,
  plannedQty: 0,
  clientPrice: 10,
  changeReason: null,
  description: 'Malowanie ścian',
  ...overrides,
})

const oneCase = (...items: ScoredItemT[]) =>
  scoreCases([{ caseNumber: 1, slug: 'a', investmentId: 100, items }])

describe('scoreCases — per case', () => {
  it('reads a pozycja the AI never filled as AI quantity 0', () => {
    const { cases, error_types } = oneCase(item({ aiPlannedQty: null, plannedQty: 3 }))
    expect(cases[0]).toMatchObject({ ai_zl: 0, owner_zl: 30, too_high_zl: 0, too_low_zl: 30 })
    expect(error_types[0]).toEqual({ case: 1, missed_zl: 30, extra_zl: 0, qty_zl: 0 })
  })

  it('counts a quantity left low on purpose as the AI being right', () => {
    const { cases, reasons } = oneCase(
      item({ aiPlannedQty: 10, plannedQty: 4, changeReason: 'Celowo ZANIŻONE, rozliczymy później' }),
    )
    expect(cases[0]).toMatchObject({ ai_zl: 100, owner_zl: 100, too_high_zl: 0 })
    expect(reasons[0].wrong_zl).toBe(0)
  })

  it('splits the wrong złoty into missed, extra and quantity', () => {
    const { error_types } = oneCase(
      item({ aiPlannedQty: 0, plannedQty: 2 }),
      item({ aiPlannedQty: 5, plannedQty: 0 }),
      item({ aiPlannedQty: 4, plannedQty: 1 }),
    )
    expect(error_types[0]).toEqual({ case: 1, missed_zl: 20, extra_zl: 50, qty_zl: 30 })
  })

  it('counts wrong złoty without a Powód only when the Powód is blank', () => {
    const { reasons } = oneCase(
      item({ aiPlannedQty: 1, plannedQty: 3, changeReason: '  ' }),
      item({ aiPlannedQty: 1, plannedQty: 4, changeReason: 'inny metraż' }),
    )
    expect(reasons[0]).toEqual({ case: 1, wrong_zl: 50, no_reason_zl: 20 })
  })
})

describe('scoreCases — repeated pozycje', () => {
  const wrongIn = (investmentIds: number[], description: string) =>
    investmentIds.map((investmentId, index) => ({
      caseNumber: index + 1,
      slug: `c${index}`,
      investmentId,
      items: [item({ description, aiPlannedQty: 1, plannedQty: 2 })],
    }))

  it('lists a pozycja wrong in three cases, matched across case and whitespace', () => {
    const { repeats, repeat_groups } = scoreCases([
      ...wrongIn([1, 2], 'Gładź  gipsowa'),
      ...wrongIn([3], 'gładź gipsowa'),
      ...wrongIn([4, 5], 'Fugowanie'),
    ])
    expect(repeats).toEqual([
      { pozycja: 'Gładź  gipsowa', wrong_in_cases: 3, reasons_written: 0, wrong_zl: 30 },
    ])
    expect(repeat_groups).toEqual([
      { group_order: 3, how_often: 'W 3 lub więcej przypadkach', wrong_zl: 30, pozycje: 1 },
      { group_order: 2, how_often: 'W 2 przypadkach', wrong_zl: 20, pozycje: 1 },
    ])
  })

  it('leaves out a pozycja the AI got right', () => {
    const { repeat_groups } = oneCase(item({ aiPlannedQty: 2, plannedQty: 2 }))
    expect(repeat_groups).toEqual([])
  })
})

describe('shortPozycja', () => {
  it('keeps a short name whole', () => {
    expect(shortPozycja('Malowanie ścian')).toBe('Malowanie ścian')
  })

  it('cuts a long name at its first segment', () => {
    const long = `Układanie glazury na ścianie, format standard - ${'x'.repeat(40)}`
    expect(shortPozycja(long)).toBe('Układanie glazury na ścianie')
  })
})

describe('toCsv', () => {
  it('quotes a cell holding a comma or a quote', () => {
    expect(toCsv([{ pozycja: 'a, b', note: 'say "x"', n: 1 }])).toBe(
      'pozycja,note,n\n"a, b","say ""x""",1\n',
    )
  })
})
