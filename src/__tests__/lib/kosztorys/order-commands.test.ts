import { describe, expect, it } from 'vitest'
import { sectionBandsVisible, orderCommandsEnabled } from '@/lib/kosztorys/order-commands'
import type { SortStateT } from '@/lib/kosztorys/row-view'

const SORTS: SortStateT[] = [
  null,
  { field: 'price', dir: 'asc', scope: 'section' },
  { field: 'price', dir: 'desc', scope: 'section' },
  { field: 'price', dir: 'asc', scope: 'global' },
  { field: 'price', dir: 'desc', scope: 'global' },
]

describe('section band commands under a sort', () => {
  // The bridge between two planes that were read apart once already: „zachowując sekcje" keeps the
  // bands on screen while the insert/reorder handlers refuse to run, so the band's menu showed four
  // live-looking commands that did nothing.
  it('never leaves an order command enabled on a band the user can still see and act on', () => {
    for (const sort of SORTS) {
      if (sectionBandsVisible(sort) && orderCommandsEnabled(sort)) {
        expect(sort).toBeNull()
      }
    }
  })

  it('keeps the bands under a section-scoped sort but freezes their order', () => {
    const sort: SortStateT = { field: 'price', dir: 'asc', scope: 'section' }
    expect(sectionBandsVisible(sort)).toBe(true)
    expect(orderCommandsEnabled(sort)).toBe(false)
  })

  it('drops the bands entirely under a global sort', () => {
    expect(sectionBandsVisible({ field: 'price', dir: 'asc', scope: 'global' })).toBe(false)
  })

  it('leaves both open with no sort on', () => {
    expect(sectionBandsVisible(null)).toBe(true)
    expect(orderCommandsEnabled(null)).toBe(true)
  })
})
