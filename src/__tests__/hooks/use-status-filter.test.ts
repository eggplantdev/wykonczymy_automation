import { describe, it, expect } from 'vitest'
import { filterByStatuses, selectionFrom } from '@/hooks/use-status-filter'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'

type RowT = { id: number; status: InvestmentStatusT }

const rows: RowT[] = [
  { id: 1, status: 'planowana' },
  { id: 2, status: 'active' },
  { id: 3, status: 'completed' },
  { id: 4, status: 'quote' },
  { id: 5, status: 'rejected' },
]

const idsFor = (selected: InvestmentStatusT[]) =>
  filterByStatuses(rows, new Set(selected), (r) => r.status)
    .map((r) => r.id)
    .sort()

describe('filterByStatuses', () => {
  it.each<[InvestmentStatusT[], number[]]>([
    [
      ['planowana', 'quote', 'active'],
      [1, 2, 4],
    ],
    [['planowana'], [1]],
    [['active'], [2]],
    [['completed'], [3]],
    [['quote'], [4]],
    [['rejected'], [5]],
    [[], [1, 2, 3, 4, 5]],
  ])('%j → rows %j (none selected narrows nothing)', (selected, ids) => {
    expect(idsFor(selected)).toEqual(ids)
  })
})

const selected = (map: Record<string, boolean>) => [...selectionFrom(map)].sort()

describe('selectionFrom — the persisted map', () => {
  it.each<[string, Record<string, boolean>, string[]]>([
    ['falls back to the defaults when nobody has picked yet', {}, ['active', 'planowana', 'quote']],
    [
      'honours an explicit all-false as the empty selection',
      { active: false, completed: false, planowana: false, quote: false },
      [],
    ],
    [
      'reads back what was picked',
      { active: false, completed: true, planowana: true, quote: false },
      ['completed', 'planowana'],
    ],
    // localStorage is client-writable, so a hand-edited value must not filter the listing away.
    [
      'degrades a value that answers nothing to the defaults',
      { nonsense: true },
      ['active', 'planowana', 'quote'],
    ],
  ])('%s', (_title, map, expected) => {
    expect(selected(map)).toEqual(expected)
  })
})

// Every map saved before `quote` existed lacks its key; read as „odznaczone" it would hide Wyceny
// for good from anyone who ever touched the filter.
describe('selectionFrom — a map saved before quote existed', () => {
  it.each<[string, Record<string, boolean>, string[]]>([
    [
      'shows quotes to whoever shows planowane',
      { planowana: true, active: true, completed: false },
      ['active', 'planowana', 'quote'],
    ],
    [
      'hides quotes from whoever hid planowane',
      { planowana: false, active: true, completed: false },
      ['active'],
    ],
    [
      'keeps an explicit all-false empty',
      { planowana: false, active: false, completed: false },
      [],
    ],
    [
      'hides rejected from a map saved before it existed',
      { planowana: true, active: true, completed: true },
      ['active', 'completed', 'planowana', 'quote'],
    ],
    [
      'lets a saved quote flag override planowana',
      { planowana: true, quote: false, active: false, completed: false },
      ['planowana'],
    ],
  ])('%s', (_title, map, expected) => {
    expect(selected(map)).toEqual(expected)
  })
})
