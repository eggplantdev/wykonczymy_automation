import { describe, expect, it } from 'vitest'

import { planKosztorysRenumber } from '@/lib/kosztorys/display-order-plan'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(
  id: number,
  sectionId: number,
  displayOrder: number,
  description: string,
): KosztorysV2RowT {
  return { id, sectionId, displayOrder, description } as KosztorysV2RowT
}

const byDescription = (r: KosztorysV2RowT) => r.description

// Section 10's stored order (0,1,2) is deliberately NOT alphabetical, and section 20 sits between
// them in the array so a plan that ignored sectionId would show up.
const ROWS = [
  row(1, 10, 0, 'tynk'),
  row(2, 10, 1, 'malowanie'),
  row(3, 20, 0, 'parapet'),
  row(4, 10, 2, 'gruntowanie'),
]

describe('planKosztorysRenumber', () => {
  // Section by section, never the sort's interleaving: the server numbers each section 0…n-1 by
  // splitting this sequence on section_id, so a sequence that wove 10 and 20 together would re-file
  // rows under whichever section they landed next to.
  it('emits one contiguous block per section, sorted within it', () => {
    const { after } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect(after).toEqual([4, 2, 1, 3])
  })

  it('covers every row exactly once', () => {
    const { before, after } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect([...after].sort()).toEqual([1, 2, 3, 4])
    expect([...before].sort()).toEqual([1, 2, 3, 4])
  })

  it('reports the stored order as before', () => {
    const { before } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect(before).toEqual([1, 2, 4, 3])
  })

  it('reads a gapped section in stored order', () => {
    const gapped = [row(1, 10, 0, 'b'), row(2, 10, 7, 'a')]

    expect(planKosztorysRenumber(gapped, byDescription, 'asc').before).toEqual([1, 2])
  })

  it('reverses under desc', () => {
    const { after } = planKosztorysRenumber(ROWS, byDescription, 'desc')

    expect(after).toEqual([1, 2, 4, 3])
  })
})
