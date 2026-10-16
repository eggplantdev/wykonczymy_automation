import { describe, expect, it } from 'vitest'
import { emptyHistoryLabel, narrowHistory } from '@/lib/fleet/history-window'
import { byInspectionType, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { ALL_TIME } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

const entry = (
  overrides: Partial<InspectionHistoryEntryT> & { performedAt: string },
): InspectionHistoryEntryT => ({
  id: 1,
  type: 'TECHNICAL',
  nextDueAt: null,
  odometer: null,
  cost: null,
  insurer: '',
  policyNumber: '',
  note: '',
  attachmentCount: 0,
  kmSincePrevious: null,
  ...overrides,
})

const historyOf = (entries: InspectionHistoryEntryT[]) =>
  byInspectionType((type) => entries.filter((candidate) => candidate.type === type))

describe('narrowHistory', () => {
  it('narrows every type and keeps every key present', () => {
    const history = historyOf([
      entry({ id: 1, type: 'TECHNICAL', performedAt: '2026-03-10' }),
      entry({ id: 2, type: 'TECHNICAL', performedAt: '2026-07-10' }),
      entry({ id: 3, type: 'SERVICE', performedAt: '2026-07-20' }),
      entry({ id: 4, type: 'SERVICE', performedAt: '2026-09-01' }),
    ])

    const narrowed = narrowHistory(history, { from: '2026-07-01', to: '2026-07-31' })

    expect(Object.keys(narrowed).sort()).toEqual([...INSPECTION_TYPES].sort())
    expect(narrowed.TECHNICAL.map((item) => item.id)).toEqual([2])
    expect(narrowed.SERVICE.map((item) => item.id)).toEqual([3])
    expect(narrowed.ODOMETER).toEqual([])
  })

  it('includes entries falling on either boundary day', () => {
    const history = historyOf([
      entry({ id: 1, performedAt: '2026-06-30' }),
      entry({ id: 2, performedAt: '2026-07-01' }),
      entry({ id: 3, performedAt: '2026-07-31' }),
      entry({ id: 4, performedAt: '2026-08-01' }),
    ])

    const narrowed = narrowHistory(history, { from: '2026-07-01', to: '2026-07-31' })

    expect(narrowed.TECHNICAL.map((item) => item.id)).toEqual([2, 3])
  })

  it('keeps kmSincePrevious on an entry whose predecessor falls outside the window', () => {
    const history = historyOf([
      entry({ id: 1, performedAt: '2026-07-10', odometer: 120_000, kmSincePrevious: 20_000 }),
      entry({ id: 2, performedAt: '2026-03-10', odometer: 100_000, kmSincePrevious: null }),
    ])

    const narrowed = narrowHistory(history, { from: '2026-07-01', to: '2026-07-31' })

    expect(narrowed.TECHNICAL).toHaveLength(1)
    expect(narrowed.TECHNICAL[0].kmSincePrevious).toBe(20_000)
  })

  it('returns everything for an empty range', () => {
    const history = historyOf([
      entry({ id: 1, performedAt: '2020-01-01' }),
      entry({ id: 2, type: 'ODOMETER', performedAt: '2026-08-25' }),
    ])

    const narrowed = narrowHistory(history, ALL_TIME)

    expect(narrowed.TECHNICAL.map((item) => item.id)).toEqual([1])
    expect(narrowed.ODOMETER.map((item) => item.id)).toEqual([2])
  })
})

describe('emptyHistoryLabel', () => {
  it('blames the window only when it is what hid the entries', () => {
    expect(emptyHistoryLabel('wpisów', true)).toBe('Brak wpisów w wybranym okresie')
  })

  it('says plainly there is nothing when the whole history is empty', () => {
    expect(emptyHistoryLabel('wpisów', false)).toBe('Brak wpisów')
  })
})
