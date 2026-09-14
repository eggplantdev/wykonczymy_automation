import { describe, expect, it } from 'vitest'
import { summariseCosts, totalCost } from '@/lib/fleet/costs'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { ALL_TIME } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

let nextId = 1

const entry = (performedAt: string, cost: number | null): InspectionHistoryEntryT => ({
  id: nextId++,
  type: 'TECHNICAL',
  performedAt,
  nextDueAt: null,
  odometer: null,
  cost,
  insurer: '',
  policyNumber: '',
  note: '',
  attachmentCount: 0,
  kmSincePrevious: null,
})

const history = (
  overrides: Partial<Record<InspectionTypeT, InspectionHistoryEntryT[]>>,
): Record<InspectionTypeT, InspectionHistoryEntryT[]> =>
  Object.fromEntries(INSPECTION_TYPES.map((type) => [type, overrides[type] ?? []])) as Record<
    InspectionTypeT,
    InspectionHistoryEntryT[]
  >

describe('summariseCosts', () => {
  it('totals per type and overall', () => {
    const costs = summariseCosts(
      history({
        TECHNICAL: [entry('2026-01-01', 200), entry('2025-01-01', 300)],
        TYRES: [entry('2026-02-01', 500)],
      }),
    )

    expect(costs.byType).toEqual([
      { type: 'TECHNICAL', count: 2, total: 500 },
      { type: 'TYRES', count: 1, total: 500 },
    ])
    expect(costs.total).toBe(1000)
  })

  // „We have never done this" is not the claim „it was free" — the successor to the old rule about
  // priceless entries, which a required „Koszt" made unreachable.
  it('leaves out a type with no inspection at all', () => {
    const costs = summariseCosts(history({ TECHNICAL: [entry('2026-01-01', 200)] }))

    expect(costs.byType.map((bucket) => bucket.type)).toEqual(['TECHNICAL'])
    expect(costs.entries).toHaveLength(1)
  })

  // A free service is a real answer and must survive into the breakdown, not be mistaken for none.
  it('keeps a zero-cost inspection', () => {
    const costs = summariseCosts(history({ TECHNICAL: [entry('2026-01-01', 0)] }))

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 1, total: 0 }])
    expect(costs.entries).toHaveLength(1)
  })

  // The przegląd happened; only its price is unknown. Dropping it from `count` would claim the car
  // has no history, and adding a zero to `total` would claim the visit was free.
  it('counts an unknown-cost inspection but keeps it out of the total', () => {
    const costs = summariseCosts(
      history({ TECHNICAL: [entry('2026-01-01', null), entry('2025-01-01', 300)] }),
    )

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 2, total: 300 }])
    expect(costs.total).toBe(300)
    expect(costs.entries).toHaveLength(2)
  })

  it('lists the entries newest first, across types', () => {
    const costs = summariseCosts(
      history({
        TECHNICAL: [entry('2026-01-01', 200)],
        TYRES: [entry('2026-06-01', 500), entry('2025-06-01', 100)],
      }),
    )

    expect(costs.entries.map((row) => row.performedAt)).toEqual([
      '2026-06-01',
      '2026-01-01',
      '2025-06-01',
    ])
  })

  // Two przeglądy happened and neither has a price: the count must still say two, while both totals
  // refuse to claim 0 zł.
  it('leaves the total unknown for a type whose every entry is unpriced', () => {
    const costs = summariseCosts(
      history({ TECHNICAL: [entry('2026-01-01', null), entry('2025-01-01', null)] }),
    )

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 2, total: null }])
    expect(costs.total).toBeNull()
  })

  // A meter reading is not work anybody was billed for. Left in, it opens a „Odczyt licznika | 1 | —"
  // bucket and inflates the „Razem" entry count with something that never had a price to begin with.
  it('leaves odometer readings out of the cost surface entirely', () => {
    const costs = summariseCosts(
      history({
        TECHNICAL: [entry('2026-01-01', 200)],
        ODOMETER: [entry('2026-03-01', null), entry('2026-04-01', null)],
      }),
    )

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 1, total: 200 }])
    expect(costs.entries).toHaveLength(1)
    expect(costs.total).toBe(200)
  })

  it('is empty when the car has no history', () => {
    expect(summariseCosts(history({}))).toEqual({ byType: [], total: 0, entries: [] })
  })
})

describe('totalCost', () => {
  const july = [
    { performedAt: '2026-06-30', cost: 1 },
    { performedAt: '2026-07-01', cost: 10 },
    { performedAt: '2026-07-15', cost: 100 },
    { performedAt: '2026-07-31', cost: 1000 },
    { performedAt: '2026-08-01', cost: 10_000 },
  ]

  it('counts everything without a window', () => {
    expect(totalCost(july, ALL_TIME)).toBe(11_111)
  })

  it('includes both ends of the window', () => {
    expect(totalCost(july, { from: '2026-07-01', to: '2026-07-31' })).toBe(1110)
  })

  it('runs to the present when only the start is given', () => {
    expect(totalCost(july, { from: '2026-07-15' })).toBe(11_100)
  })

  it('runs from the beginning when only the end is given', () => {
    expect(totalCost(july, { to: '2026-07-15' })).toBe(111)
  })

  // The listing hands over raw stored timestamps; comparing those as strings would drop the window's
  // last day, because any '2026-07-31T…' sorts after the bare '2026-07-31'.
  it('windows a stored timestamp by its Warsaw day', () => {
    const stored = [{ performedAt: '2026-07-31T00:00:00.000Z', cost: 500 }]

    expect(totalCost(stored, { from: '2026-07-01', to: '2026-07-31' })).toBe(500)
  })

  // An unknown price is not a free one: coercing `null` to 0 would be invisible in the total, which
  // is exactly what makes it dangerous.
  it('skips the entries whose cost is unknown', () => {
    const mixed = [
      { performedAt: '2026-07-01', cost: null },
      { performedAt: '2026-07-02', cost: 250 },
    ]

    expect(totalCost(mixed, ALL_TIME)).toBe(250)
  })

  // Nothing left to add up is a different answer from „it was free" — the whole imported fleet lands
  // in this state, and 0 zł would have been a lie on every one of the nine cars.
  it('is unknown when the window holds only unpriced entries', () => {
    const unpriced = [
      { performedAt: '2026-07-01', cost: null },
      { performedAt: '2026-07-02', cost: null },
    ]

    expect(totalCost(unpriced, ALL_TIME)).toBeNull()
    expect(totalCost(unpriced, { from: '2026-07-02' })).toBeNull()
  })

  // A real zero survives: free work is a price somebody typed.
  it('keeps a zero that was actually recorded', () => {
    expect(totalCost([{ performedAt: '2026-07-01', cost: 0 }], ALL_TIME)).toBe(0)
  })

  it('is zero when nothing falls inside', () => {
    expect(totalCost(july, { from: '2027-01-01' })).toBe(0)
    expect(totalCost([], ALL_TIME)).toBe(0)
  })
})
