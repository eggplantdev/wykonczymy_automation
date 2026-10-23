import { describe, expect, it } from 'vitest'
import {
  scoreCases,
  shortPozycja,
  summarizeAccuracy,
  type AiAccuracyCaseInputT,
  type AiAccuracyItemT,
} from '@/lib/kosztorys/ai-accuracy'

const item = (overrides: Partial<AiAccuracyItemT>): AiAccuracyItemT => ({
  aiPlannedQty: 0,
  plannedQty: 0,
  clientPrice: 10,
  changeReason: null,
  description: 'Malowanie ścian',
  unit: 'm²',
  sectionId: 1,
  ...overrides,
})

const oneCase = (...items: AiAccuracyItemT[]) =>
  scoreCases([{ investmentId: 100, label: 'Mokotów', items }])

describe('scoreCases — per case', () => {
  it('reads a pozycja the AI never filled as AI quantity 0', () => {
    const { cases, error_types } = oneCase(item({ aiPlannedQty: null, plannedQty: 3 }))
    expect(cases[0]).toEqual({
      investmentId: 100,
      label: 'Mokotów',
      ai_zl: 0,
      owner_zl: 30,
      too_high_zl: 0,
      too_low_zl: 30,
    })
    expect(error_types[0]).toEqual({
      investmentId: 100,
      missed_zl: 30,
      extra_zl: 0,
      qty_zl: 0,
      variant_zl: 0,
    })
  })

  it('counts a quantity left low on purpose as the AI being right', () => {
    const { cases, reasons } = oneCase(
      item({
        aiPlannedQty: 10,
        plannedQty: 4,
        changeReason: 'Celowo ZANIŻONE, rozliczymy później',
      }),
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
    expect(error_types[0]).toEqual({
      investmentId: 100,
      missed_zl: 20,
      extra_zl: 50,
      qty_zl: 30,
      variant_zl: 0,
    })
  })

  it('counts wrong złoty without a Powód only when the Powód is blank', () => {
    const { reasons } = oneCase(
      item({ aiPlannedQty: 1, plannedQty: 3, changeReason: '  ' }),
      item({ aiPlannedQty: 1, plannedQty: 4, changeReason: 'inny metraż' }),
    )
    expect(reasons[0]).toEqual({ investmentId: 100, wrong_zl: 50, no_reason_zl: 20 })
  })
})

describe('scoreCases — wrong variant', () => {
  const aiVariant = item({
    description: 'Klejenie paneli winylowych układ prosty',
    aiPlannedQty: 10,
    clientPrice: 10,
  })
  const ownerVariant = item({
    description: 'Układanie paneli laminowanych',
    plannedQty: 10,
    clientPrice: 8,
  })

  it('counts the same quantity moved to another pozycja of the same work as the price gap', () => {
    const { cases, error_types, reasons } = oneCase(aiVariant, ownerVariant)
    expect(cases[0]).toMatchObject({ ai_zl: 100, owner_zl: 80, too_high_zl: 20, too_low_zl: 0 })
    expect(error_types[0]).toMatchObject({ missed_zl: 0, extra_zl: 0, qty_zl: 0, variant_zl: 20 })
    expect(reasons[0]).toMatchObject({ wrong_zl: 20, no_reason_zl: 20 })
  })

  it('reads the Powód from either pozycja of the pair', () => {
    const { reasons } = oneCase(aiVariant, { ...ownerVariant, changeReason: 'laminat, nie winyl' })
    expect(reasons[0]).toMatchObject({ wrong_zl: 20, no_reason_zl: 0 })
  })

  it.each([
    ['another kind of work', { description: 'Gruntowanie paneli' }],
    ['another section', { sectionId: 2 }],
    ['another unit', { unit: 'mb' }],
    ['a quantity more than 2% off', { plannedQty: 10.5 }],
  ])('keeps a pozycja in %s as extra and missed', (_label, overrides) => {
    const { error_types } = oneCase(aiVariant, { ...ownerVariant, ...overrides })
    expect(error_types[0]).toMatchObject({ variant_zl: 0, extra_zl: 100 })
  })

  it('pairs each owner pozycja with one AI pozycja only', () => {
    const { error_types } = oneCase(aiVariant, { ...aiVariant, clientPrice: 9 }, ownerVariant)
    expect(error_types[0]).toMatchObject({ variant_zl: 20, extra_zl: 90, missed_zl: 0 })
  })

  it('leaves the owner pozycja of a pair out of the repeated pozycje', () => {
    const { repeats } = scoreCases(
      [1, 2, 3].map((investmentId) => ({
        investmentId,
        label: `c${investmentId}`,
        items: [aiVariant, ownerVariant],
      })),
    )
    expect(repeats).toEqual([
      {
        pozycja: 'Klejenie paneli winylowych układ prosty',
        wrong_in_cases: 3,
        reasons_written: 0,
        wrong_zl: 60,
      },
    ])
  })
})

describe('scoreCases — repeated pozycje', () => {
  const wrongIn = (investmentIds: number[], description: string) =>
    investmentIds.map((investmentId) => ({
      investmentId,
      label: `c${investmentId}`,
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

describe('summarizeAccuracy', () => {
  const caseOff = (investmentId: number, wrongZl: number): AiAccuracyCaseInputT => ({
    investmentId,
    label: `Inwestycja ${investmentId}`,
    items: [
      item({ aiPlannedQty: 10 + wrongZl / 10, plannedQty: 10, description: `p${investmentId}` }),
    ],
  })
  const summarize = (...cases: AiAccuracyCaseInputT[]) => summarizeAccuracy(scoreCases(cases))

  it('never scores a case below 0% when the errors exceed the whole kosztorys', () => {
    const { cases } = summarize(caseOff(1, 250))
    expect(cases[0]).toMatchObject({ ownerZl: 100, wrongZl: 250, rightPercent: 0 })
  })

  it('never scores the tiles or the example below 0% either', () => {
    const { windows, example } = summarize(caseOff(1, 250))
    expect(windows.last).toMatchObject({ rightPercent: 0, wrongPer100: 100 })
    expect(example).toMatchObject({ rightPercent: 0, priceMatchPercent: 0 })
  })

  it('averages over the cases so far while fewer than five came before', () => {
    const { cases } = summarize(caseOff(1, 10), caseOff(2, 30))
    expect(cases.map((score) => score.rightPercent)).toEqual([90, 70])
    expect(cases.map((score) => score.rollingPercent)).toEqual([90, 80])
  })

  it('rolls the average over the last five cases only', () => {
    const { cases } = summarize(
      ...[100, 0, 0, 0, 0, 0].map((wrong, index) => caseOff(index + 1, wrong)),
    )
    expect(cases[4].rollingPercent).toBe(80)
    expect(cases[5].rollingPercent).toBe(100)
  })

  it('sums the tiles over all cases and the last five', () => {
    const { windows } = summarize(
      ...[60, 0, 0, 0, 0, 20].map((wrong, index) => caseOff(index + 1, wrong)),
    )
    expect(windows.all).toMatchObject({ rightPercent: 87, wrongPer100: 13 })
    expect(windows.last).toMatchObject({ rightPercent: 96, count: 5 })
  })

  it('shares the wrong złoty between missed, extra, quantity and variant', () => {
    const { windows } = summarize({
      investmentId: 1,
      label: 'a',
      items: [
        item({ aiPlannedQty: 0, plannedQty: 1 }),
        item({ aiPlannedQty: 3, plannedQty: 0, changeReason: 'klient nie chce' }),
        item({ aiPlannedQty: 4, plannedQty: 0, description: 'Gładź Q3', clientPrice: 15 }),
        item({ aiPlannedQty: 0, plannedQty: 4, description: 'Gładź Q4', clientPrice: 10 }),
      ],
    })
    expect(windows.all).toMatchObject({
      missedZl: 10,
      extraZl: 30,
      qtyZl: 0,
      variantZl: 20,
      extraPercent: 50,
      noReasonPercent: 50,
    })
  })

  it('compares the first case by final price and by summed errors', () => {
    const { example } = summarize({
      investmentId: 1,
      label: 'a',
      items: [
        item({ aiPlannedQty: 6, plannedQty: 5, description: 'x' }),
        item({ aiPlannedQty: 4, plannedQty: 5, description: 'y' }),
      ],
    })
    expect(example).toMatchObject({
      priceGapZl: 0,
      priceMatchPercent: 100,
      wrongZl: 20,
      rightPercent: 80,
    })
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
