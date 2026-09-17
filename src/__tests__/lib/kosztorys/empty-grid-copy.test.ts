import { describe, expect, it } from 'vitest'
import { emptyGridCopy } from '@/lib/kosztorys/empty-grid-copy'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

const condition = (id: string, label: string) => ({ id, label }) as RowConditionT

describe('emptyGridCopy', () => {
  it('names the filters that emptied the grid', () => {
    const copy = emptyGridCopy({
      preview: false,
      hiders: [condition('no-planned', 'bez przedmiaru'), condition('planned', 'z przedmiarem')],
      diagnostics: [],
    })
    expect(copy.title).toBe('Wszystkie pozycje schowane')
    expect(copy.description).toBe('Filtr chowa pozycje bez przedmiaru i z przedmiarem.')
  })

  // The heading still has to stand alone — naming which filter did it is what drops out.
  it('still says something when a filter carries no label', () => {
    const copy = emptyGridCopy({ preview: false, hiders: [condition('x', '')], diagnostics: [] })
    expect(copy.title).toBe('Wszystkie pozycje schowane')
    expect(copy.description).toBeUndefined()
  })

  // Unreachable through the editor's render gate, but the module no longer depends on that: the old
  // fall-through titled the overlay „Brak pozycji " and blamed a filter nobody engaged.
  it('says something neutral when nothing is engaged at all', () => {
    const copy = emptyGridCopy({ preview: false, hiders: [], diagnostics: [] })
    expect(copy.title).toBe('Brak pozycji do pokazania')
    expect(copy.description).toBeUndefined()
  })

  it('names the diagnostics when no filter is engaged', () => {
    const copy = emptyGridCopy({
      preview: false,
      hiders: [],
      diagnostics: [condition('no-price', 'bez ceny j.m.')],
    })
    expect(copy.title).toBe('Brak pozycji bez ceny j.m.')
  })

  it('tells the client nothing about filters', () => {
    const copy = emptyGridCopy({
      preview: true,
      hiders: [condition('no-planned', 'bez przedmiaru')],
      diagnostics: [],
    })
    expect(copy.title).toBe('Brak pozycji do pokazania')
  })
})
