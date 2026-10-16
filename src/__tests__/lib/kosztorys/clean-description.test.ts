import { describe, it, expect } from 'vitest'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { cleanDescription } from '@/lib/kosztorys/clean-description'

describe('cleanDescription', () => {
  it('raises the name the owner corrected in the katalog', () => {
    expect(cleanDescription('lutowanie tasm ledowych')).toBe('Lutowanie taśm LED')
    expect(cleanDescription('Lutowanie taśm ledowych')).toBe('Lutowanie taśm LED')
  })

  it('finds the entry even when the opis was SHOUTED', () => {
    expect(cleanDescription('LUTOWANIE TAŚM LEDOWYCH')).toBe('Lutowanie taśm LED')
  })

  it('raises a name whose only defect is a missing dywiz', () => {
    expect(cleanDescription('doprowadzenie przewodu 3 fazowego')).toBe(
      'Doprowadzenie przewodu 3-fazowego',
    )
  })

  it('leaves a name the table does not know to the existing rules', () => {
    expect(cleanDescription('MALOWANIE ŚCIAN W KUCHNI')).toBe('Malowanie ścian w kuchni')
    expect(cleanDescription('Szpachlowanie po fisnish')).toBe('Szpachlowanie po finish')
  })

  it('leaves every corrected name in the table untouched on a second press', () => {
    const moved = [...CATALOGUE_NAME_FIXES.values()].filter(
      (name) => cleanDescription(name) !== name,
    )
    expect(moved).toEqual([])
  })

  it('does not start a sentence after „wg."', () => {
    expect(cleanDescription('Sufit podwieszany z LED wg. projektu')).toBe(
      'Sufit podwieszany z LED wg. projektu',
    )
  })

  it('is idempotent, so the button survives being pressed twice', () => {
    for (const text of [
      'lutowanie tasm ledowych',
      'doprowadzenie przewodu 3 fazowego',
      'MALOWANIE ŚCIAN W KUCHNI',
      'Szpachlowanie po fisnish',
      'motnaz tv',
    ]) {
      expect(cleanDescription(cleanDescription(text))).toBe(cleanDescription(text))
    }
  })
})
