import { describe, it, expect } from 'vitest'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { cleanDescription } from '@/lib/kosztorys/clean-description'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'

describe('cleanDescription', () => {
  // The reason the table was wired in at all: on szablon 4 the substring rules corrected 0 of the
  // 30 reported names, because the defects are missing ogonki and KNR line breaks.
  it('raises the name the owner corrected in the katalog', () => {
    expect(cleanDescription('lutowanie tasm ledowych')).toBe('Lutowanie taśm LED')
    expect(cleanDescription('Lutowanie taśm ledowych')).toBe('Lutowanie taśm LED')
  })

  it('finds the entry even when the opis was SHOUTED', () => {
    expect(cleanDescription('LUTOWANIE TAŚM LEDOWYCH')).toBe('Lutowanie taśm LED')
  })

  // The katalog review note lives on the katalog row, never in a client's oferta.
  it('never carries the „[stary arkusz]" note into the opis', () => {
    const cleaned = cleanDescription('doprowadzenie przewodu 3 fazowego')
    expect(cleaned).toBe('Doprowadzenie przewodu 3-fazowego')
    expect(hasLegacyMarker(cleaned)).toBe(false)
  })

  // The risk the table introduces: a whole-name hit swallowing what the old path handled.
  it('leaves a name the table does not know to the existing rules', () => {
    expect(cleanDescription('MALOWANIE ŚCIAN W KUCHNI')).toBe('Malowanie ścian w kuchni')
    expect(cleanDescription('Szpachlowanie po fisnish')).toBe('Szpachlowanie po finish')
  })

  // The picker copies a katalog opis verbatim, marker and all, so the button meets marked text in
  // a rozpiska — and the table exists precisely for the prace that came out of the old sheets.
  it('corrects a praca that still carries the katalog review note', () => {
    expect(cleanDescription('motnaz tv [stary arkusz]')).toBe('Montaż TV [stary arkusz]')
  })

  // Hand-picked inputs cannot answer this — the property belongs to all 915 corrected names, and
  // the one that broke it („c.w.u. Oraz z.w.u.") was not among the four originally listed here.
  it('leaves every corrected name in the table untouched on a second press', () => {
    const moved = [...CATALOGUE_NAME_FIXES.values()].filter(
      (name) => cleanDescription(name) !== name,
    )
    expect(moved).toEqual([])
  })

  it('is idempotent, so the button survives being pressed twice', () => {
    for (const text of [
      'lutowanie tasm ledowych',
      'doprowadzenie przewodu 3 fazowego',
      'MALOWANIE ŚCIAN W KUCHNI',
      'Szpachlowanie po fisnish',
      'motnaz tv [stary arkusz]',
    ]) {
      expect(cleanDescription(cleanDescription(text))).toBe(cleanDescription(text))
    }
  })
})
