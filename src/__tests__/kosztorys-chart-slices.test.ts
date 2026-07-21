import { describe, it, expect } from 'vitest'
import {
  CHART_FILLS,
  costPieSlices,
  sectionPieSlices,
  type SectionSliceInputT,
} from '@/lib/kosztorys/chart-slices'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

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

describe('costPieSlices', () => {
  const materialy: MaterialyBreakdownRowT[] = [
    { id: 1, label: 'Materiały budowlane', net: 2000 },
    { id: 2, label: 'Materiały wykończeniowe', net: 0 },
    { id: null, label: 'Pozostałe koszty', net: 300 },
  ]

  it('emits a robocizna slice plus one per non-zero materiały category', () => {
    const slices = costPieSlices(5000, materialy)
    expect(slices.map((s) => s.name)).toEqual([
      'Robocizna',
      'Materiały budowlane',
      'Pozostałe koszty',
    ])
    expect(slices.map((s) => s.value)).toEqual([5000, 2000, 300])
  })

  it('drops materiały rows with net === 0', () => {
    const slices = costPieSlices(5000, materialy)
    expect(slices.some((s) => s.name === 'Materiały wykończeniowe')).toBe(false)
  })

  it('assigns fills by index from the palette', () => {
    const slices = costPieSlices(5000, materialy)
    expect(slices.map((s) => s.fill)).toEqual([CHART_FILLS[0], CHART_FILLS[1], CHART_FILLS[2]])
  })

  it('gives each slice a stable unique id, korekta bucket keyed distinctly (React key safety)', () => {
    const ids = costPieSlices(5000, materialy).map((s) => s.id)
    expect(ids).toEqual(['robocizna', 'materialy-1', 'korekta'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
