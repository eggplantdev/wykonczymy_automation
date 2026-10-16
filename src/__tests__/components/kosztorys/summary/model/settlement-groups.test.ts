import { describe, expect, it } from 'vitest'
import { buildSettlementGroups } from '@/components/kosztorys/summary/model/settlement-groups'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

const rowNamed = (groups: ReturnType<typeof buildSettlementGroups>, label: string) =>
  groups.flatMap((group) => group.rows).find((row) => row.label === label)

const build = (over: Partial<Parameters<typeof buildSettlementGroups>[0]> = {}) =>
  buildSettlementGroups({
    paid: { net: 300, gross: 300 },
    amountDue: { net: 1000, gross: 1230 },
    lossAmount: 0,
    axis: 'net',
    ...over,
  })

describe('buildSettlementGroups', () => {
  it('is a single uncaptioned table, whatever the tryb', () => {
    for (const axis of ['net', 'gross', 'both'] as MoneyAxisT[]) {
      const groups = build({ axis })
      expect(groups).toHaveLength(1)
      expect(groups[0]?.caption).toBeUndefined()
    }
  })

  it('stands in the panel’s own money columns rather than choosing its own', () => {
    expect(build({ axis: 'gross' })[0]?.axis).toBe('gross')
    expect(build({ axis: 'net' })[0]?.axis).toBe('net')
  })

  it('reads top-down: wpłaty, then „Pozostało do zapłaty"', () => {
    expect(build()[0]?.rows.map((row) => row.label)).toEqual(['Wpłaty', 'Pozostało do zapłaty'])
  })

  it('deducts each plane’s own kwota, negated', () => {
    const groups = build({ paid: { net: 250, gross: 300 } })
    expect(rowNamed(groups, 'Wpłaty')?.line).toEqual({ net: -250, gross: -300 })
    expect(rowNamed(groups, 'Wpłaty')?.discount).toBe(true)
  })

  it('quotes ONE debt on both planes — a row across the columns, never a row each', () => {
    const groups = build({ amountDue: { net: 1000, gross: 1230 } })
    expect(rowNamed(groups, 'Pozostało do zapłaty')?.line).toEqual({ net: 1000, gross: 1230 })
    expect(rowNamed(groups, 'Pozostało netto')).toBeUndefined()
    expect(rowNamed(groups, 'Do zapłaty brutto')).toBeUndefined()
  })

  it('carries no materiały step', () => {
    expect(rowNamed(build(), 'Materiały')).toBeUndefined()
  })
})

describe('the „Pozostało do zapłaty" alarm', () => {
  it('tones each column from its own figure when the planes differ in sign', () => {
    const groups = build({ axis: 'both', amountDue: { net: -100, gross: 130 } })
    expect(groups[0]?.rows.at(-1)?.danger).toEqual({ net: false, gross: true })
  })

  it('rounds first, so a floating-point residue is not a debt', () => {
    const groups = build({ amountDue: { net: 7e-12, gross: 0 } })
    expect(rowNamed(groups, 'Pozostało do zapłaty')?.danger).toEqual({ net: false, gross: false })
  })
})

describe('the strata step', () => {
  it('renders nothing when nothing was absorbed', () => {
    expect(rowNamed(build({ lossAmount: 0 }), 'Strata')).toBeUndefined()
  })

  it('sits between the wpłaty and the debt, at face value on both planes, in either tryb', () => {
    for (const axis of ['net', 'gross'] as MoneyAxisT[]) {
      const groups = build({ lossAmount: 250, axis })
      expect(groups[0]?.rows.map((row) => row.label)).toEqual([
        'Wpłaty',
        'Strata',
        'Pozostało do zapłaty',
      ])
      expect(rowNamed(groups, 'Strata')?.line).toEqual({ net: -250, gross: -250 })
    }
  })
})

describe('a negative balance', () => {
  const footnote = '*Minusowa kwota oznacza nadpłatę'

  it('keeps the debt label, starred, with the footnote', () => {
    const groups = build({ amountDue: { net: -100, gross: -123 } })
    expect(groups[0]?.rows.at(-1)?.label).toBe('Pozostało do zapłaty*')
    expect(groups[0]?.footnote).toBe(footnote)
  })

  it('explains a minus on any rendered plane, even beside an outstanding one', () => {
    const groups = build({ axis: 'both', amountDue: { net: -100, gross: 130 } })
    expect(groups[0]?.footnote).toBe(footnote)
  })

  it('ignores a minus on a plane the tryb does not render', () => {
    expect(
      build({ axis: 'gross', amountDue: { net: -100, gross: 130 } })[0]?.footnote,
    ).toBeUndefined()
  })

  it('adds nothing at zero', () => {
    const groups = build({ amountDue: { net: 0, gross: 0 } })
    expect(groups[0]?.rows.at(-1)?.label).toBe('Pozostało do zapłaty')
    expect(groups[0]?.footnote).toBeUndefined()
  })
})
