import { describe, expect, it } from 'vitest'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import {
  resolveSectionTarget,
  sectionNameOptions,
} from '@/lib/kosztorys/work-catalogue/section-target'

const section = (sectionId: number, sectionName: string): SectionSubtotalT => ({
  sectionId,
  sectionName,
  sectionColor: null,
  net: 0,
  plannedNet: 0,
  discount: 0,
  share: 0,
  completionRatio: null,
  itemCount: 0,
})

const SECTIONS = [section(1, 'Łazienka'), section(2, 'Kuchnia')]

describe('sectionNameOptions', () => {
  it('keeps the sekcje in rozpiska order', () => {
    expect(sectionNameOptions(SECTIONS)).toEqual(['Łazienka', 'Kuchnia'])
  })

  it('drops a repeated nazwa, keeping the first spelling', () => {
    const options = sectionNameOptions([...SECTIONS, section(3, '  łazienka ')])
    expect(options).toEqual(['Łazienka', 'Kuchnia'])
  })

  it('drops a sekcja with no nazwa', () => {
    expect(sectionNameOptions([section(1, '   '), section(2, 'Kuchnia')])).toEqual(['Kuchnia'])
  })
})

describe('resolveSectionTarget', () => {
  it('has no target for a blank nazwa', () => {
    expect(resolveSectionTarget('   ', SECTIONS)).toBeUndefined()
  })

  it('matches an existing sekcja ignoring wielkość liter i spacje', () => {
    expect(resolveSectionTarget('  łAZIENKA ', SECTIONS)).toEqual({
      kind: 'existing',
      sectionId: 1,
    })
  })

  it('treats an unknown nazwa as a nowa sekcja, trimmed', () => {
    expect(resolveSectionTarget('  Salon  ', SECTIONS)).toEqual({ kind: 'new', name: 'Salon' })
  })

  it('keeps the sekcja the picker was opened from when the nazwa is still its own', () => {
    const twins = [...SECTIONS, section(3, 'Łazienka')]
    expect(resolveSectionTarget('Łazienka', twins, 3)).toEqual({ kind: 'existing', sectionId: 3 })
  })

  it('falls back to the first sekcja of that nazwa once the nazwa was changed', () => {
    const twins = [...SECTIONS, section(3, 'Łazienka')]
    expect(resolveSectionTarget('Kuchnia', twins, 3)).toEqual({ kind: 'existing', sectionId: 2 })
  })
})
