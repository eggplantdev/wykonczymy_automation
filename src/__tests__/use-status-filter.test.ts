import { describe, it, expect } from 'vitest'
import { filterByStatuses, selectionFrom } from '@/hooks/use-status-filter'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'

type RowT = { id: number; status: InvestmentStatusT }

const rows: RowT[] = [
  { id: 1, status: 'planowana' },
  { id: 2, status: 'active' },
  { id: 3, status: 'completed' },
  { id: 4, status: 'quote' },
]

const idsFor = (selected: InvestmentStatusT[]) =>
  filterByStatuses(rows, new Set(selected), (r) => r.status)
    .map((r) => r.id)
    .sort()

describe('filterByStatuses', () => {
  it('default (planowana + quote + active) → hides completed', () => {
    expect(idsFor(['planowana', 'quote', 'active'])).toEqual([1, 2, 4])
  })

  it('planowana only → only prospects', () => {
    expect(idsFor(['planowana'])).toEqual([1])
  })

  it('active only → only active', () => {
    expect(idsFor(['active'])).toEqual([2])
  })

  it('completed only → only completed', () => {
    expect(idsFor(['completed'])).toEqual([3])
  })

  it('quote only → only quotes', () => {
    expect(idsFor(['quote'])).toEqual([4])
  })

  it('all selected → every row', () => {
    expect(idsFor(['planowana', 'quote', 'active', 'completed'])).toEqual([1, 2, 3, 4])
  })

  it('none selected → no rows', () => {
    expect(idsFor([])).toEqual([])
  })
})

describe('selectionFrom — the persisted map', () => {
  it('falls back to the defaults when nobody has picked yet', () => {
    expect([...selectionFrom({})].sort()).toEqual(['active', 'planowana', 'quote'])
  })

  // The reason the map holds a flag per status instead of a list of the picked ones: „wybrano nic"
  // and „jeszcze nie wybierano" are different answers, and a list says the same thing for both.
  it('honours an explicit all-false as the empty selection', () => {
    expect([
      ...selectionFrom({ active: false, completed: false, planowana: false, quote: false }),
    ]).toEqual([])
  })

  it('reads back what was picked', () => {
    expect(
      [...selectionFrom({ active: false, completed: true, planowana: true, quote: false })].sort(),
    ).toEqual(['completed', 'planowana'])
  })

  // localStorage is client-writable, so a hand-edited value must not filter the listing away.
  it('degrades a value that answers nothing to the defaults', () => {
    expect([...selectionFrom({ nonsense: true } as Record<string, boolean>)].sort()).toEqual([
      'active',
      'planowana',
      'quote',
    ])
  })
})

// Every map saved before `quote` existed lacks its key; read as „odznaczone" it would hide Wyceny
// for good from anyone who ever touched the filter.
describe('selectionFrom — a map saved before quote existed', () => {
  it('shows quotes to whoever shows planowane', () => {
    expect([...selectionFrom({ planowana: true, active: true, completed: false })].sort()).toEqual([
      'active',
      'planowana',
      'quote',
    ])
  })

  it('hides quotes from whoever hid planowane', () => {
    expect([...selectionFrom({ planowana: false, active: true, completed: false })]).toEqual([
      'active',
    ])
  })

  it('keeps an explicit all-false empty', () => {
    expect([...selectionFrom({ planowana: false, active: false, completed: false })]).toEqual([])
  })

  it('lets a saved quote flag override planowana', () => {
    expect([
      ...selectionFrom({ planowana: true, quote: false, active: false, completed: false }),
    ]).toEqual(['planowana'])
  })
})
