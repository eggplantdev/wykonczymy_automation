import { describe, expect, it } from 'vitest'
import { activeOrSelected, matchingOrSelected } from '@/lib/utils/is-active-ref'

const ANNA = { id: 1, name: 'Anna', active: true }
const BOGDAN = { id: 2, name: 'Bogdan', active: false }
// `active` absent means active — the reference-data rows don't always carry the flag.
const CEZARY = { id: 3, name: 'Cezary' }
const ROSTER = [ANNA, BOGDAN, CEZARY]

describe('activeOrSelected', () => {
  it('keeps a deactivated item while it is the current selection', () => {
    expect(activeOrSelected(ROSTER, true, 2)).toEqual([ANNA, BOGDAN, CEZARY])
  })

  it('drops a deactivated item once something else is selected', () => {
    expect(activeOrSelected(ROSTER, true, 1)).toEqual([ANNA, CEZARY])
  })

  it('matches a selection held as a string, the shape form state keeps', () => {
    expect(activeOrSelected(ROSTER, true, '2')).toContain(BOGDAN)
  })

  it('drops the deactivated item when nothing is selected', () => {
    expect(activeOrSelected(ROSTER, true, null)).toEqual([ANNA, CEZARY])
    expect(activeOrSelected(ROSTER, true, undefined)).toEqual([ANNA, CEZARY])
  })

  it('lists everyone once the active filter is widened', () => {
    expect(activeOrSelected(ROSTER, false, null)).toEqual(ROSTER)
  })
})

describe('matchingOrSelected', () => {
  const startsWithA = (item: { name: string }) => item.name.startsWith('A')

  it('keeps only the items the predicate accepts', () => {
    expect(matchingOrSelected(ROSTER, startsWithA, null)).toEqual([ANNA])
  })

  it('keeps the current selection even when the predicate rejects it', () => {
    expect(matchingOrSelected(ROSTER, startsWithA, '3')).toEqual([ANNA, CEZARY])
  })
})
