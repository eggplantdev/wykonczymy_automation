import { describe, it, expect } from 'vitest'
import {
  CHART_FILLS,
  sectionPieSlices,
  type SectionSliceInputT,
} from '@/lib/kosztorys/chart-slices'

const sections: SectionSliceInputT[] = [
  { sectionId: 1, sectionName: 'Łazienka', plannedNet: 1000, net: 400 },
  { sectionId: 2, sectionName: 'Podłogi', plannedNet: 500, net: 600 },
]

describe('sectionPieSlices', () => {
  it('selects plannedNet (offer) under the przedmiar base', () => {
    expect(sectionPieSlices(sections, 'przedmiar').map((s) => s.value)).toEqual([1000, 500])
  })

  it('selects net (executed) under the wykonane base', () => {
    expect(sectionPieSlices(sections, 'wykonane').map((s) => s.value)).toEqual([400, 600])
  })

  it('emits one slice per section, named by section', () => {
    const slices = sectionPieSlices(sections, 'przedmiar')
    expect(slices).toHaveLength(sections.length)
    expect(slices.map((s) => s.name)).toEqual(['Łazienka', 'Podłogi'])
  })

  it('gives colliding section names distinct stable ids (React key safety)', () => {
    const collide: SectionSliceInputT[] = [
      { sectionId: 7, sectionName: 'Łazienka', plannedNet: 100, net: 0 },
      { sectionId: 9, sectionName: 'Łazienka', plannedNet: 200, net: 0 },
    ]
    const ids = sectionPieSlices(collide, 'przedmiar').map((s) => s.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toEqual(['section-7', 'section-9'])
  })

  it('assigns fills by index, cycling the palette', () => {
    const many: SectionSliceInputT[] = Array.from({ length: CHART_FILLS.length + 1 }, (_, i) => ({
      sectionId: i,
      sectionName: `S${i}`,
      plannedNet: 1,
      net: 1,
    }))
    const slices = sectionPieSlices(many, 'przedmiar')
    expect(slices[0].fill).toBe(CHART_FILLS[0])
    // Wraps around after the palette is exhausted.
    expect(slices[CHART_FILLS.length].fill).toBe(CHART_FILLS[0])
  })
})
