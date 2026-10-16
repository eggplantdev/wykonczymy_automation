import { describe, expect, it } from 'vitest'
import { emptyGridCopy } from '@/lib/kosztorys/empty-grid-copy'
import { REPORT_UNREPORTED_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

const condition = (id: string, label: string) => ({ id, label }) as RowConditionT

describe('emptyGridCopy', () => {
  it('names the filters that emptied the grid', () => {
    const copy = emptyGridCopy({
      preview: false,
      filters: [condition('no-planned', 'bez przedmiaru'), condition('planned', 'z przedmiarem')],
      clientHiders: [],
      diagnostics: [],
    })
    expect(copy.title).toBe('Brak pozycji spełniających filtry')
    expect(copy.description).toBe('Filtry pokazują tylko pozycje bez przedmiaru i z przedmiarem.')
  })

  it('counts the filters instead of listing them once there are too many to read', () => {
    const copy = emptyGridCopy({
      preview: false,
      filters: Array.from({ length: 12 }, (_, index) => condition(`c${index}`, `filtr ${index}`)),
      clientHiders: [],
      diagnostics: [],
    })
    expect(copy.title).toBe('Brak pozycji spełniających filtry')
    expect(copy.description).toContain('12')
    expect(copy.description).not.toContain('filtr 7')
  })

  it('still says something when a filter carries no label', () => {
    const copy = emptyGridCopy({
      preview: false,
      filters: [condition('x', '')],
      clientHiders: [],
      diagnostics: [],
    })
    expect(copy.title).toBe('Brak pozycji spełniających filtry')
    expect(copy.description).toBeUndefined()
  })

  it('says something neutral when nothing is engaged at all', () => {
    const copy = emptyGridCopy({ preview: false, filters: [], clientHiders: [], diagnostics: [] })
    expect(copy.title).toBe('Brak pozycji do pokazania')
    expect(copy.description).toBeUndefined()
  })

  it('names the diagnostics when no filter is engaged', () => {
    const copy = emptyGridCopy({
      preview: false,
      filters: [],
      clientHiders: [],
      diagnostics: [condition('no-price', 'bez ceny j.m.')],
    })
    expect(copy.title).toBe('Brak pozycji bez ceny j.m.')
  })

  it('tells the client nothing about filters', () => {
    const copy = emptyGridCopy({
      preview: true,
      filters: [condition('no-planned', 'bez przedmiaru')],
      clientHiders: [],
      diagnostics: [],
    })
    expect(copy.title).toBe('Brak pozycji do pokazania')
  })

  it('tells a worker report it holds nothing reported yet', () => {
    const copy = emptyGridCopy({
      preview: true,
      filters: [],
      clientHiders: [condition(REPORT_UNREPORTED_CONDITION_ID, '')],
      diagnostics: [],
    })
    expect(copy.title).toBe('Nic jeszcze nie zgłoszono')
  })
})
