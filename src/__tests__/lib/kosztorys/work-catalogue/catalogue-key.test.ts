import { describe, expect, it } from 'vitest'
import { cleanDescription, TYPO_FIXES } from '@/lib/kosztorys/clean-description'
import { itemKey } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const key = (description: string, unit: string | null = 'm2') => catalogueKey(description, unit)

describe('catalogueKey', () => {
  it('keys the same across case, diacritics and whitespace runs', () => {
    expect(key('Malowanie  ŚCIAN')).toBe(key('malowanie scian'))
  })

  it('folds the j.m. the same way as the opis', () => {
    expect(key('Malowanie ścian', 'M2')).toBe(key('Malowanie ścian', ' m2 '))
  })

  // The guarantee the katalog rests on: whatever „Popraw literówki" does to an opis in a rozpiska,
  // the katalog entry saved from it still matches. Table-driven over the whole rule set so a rule
  // added later has to hold it too.
  it.each(TYPO_FIXES.map(([from]) => from))(
    'keys „%s" the same before and after the cleaner rewrites it',
    (typo) => {
      const before = `Wykonanie ${typo} w łazience`
      expect(key(before)).toBe(key(cleanDescription(before)))
      expect(key(before.toUpperCase())).toBe(key(cleanDescription(before.toUpperCase())))
    },
  )

  it('keeps two genuinely different opisy apart', () => {
    expect(key('Malowanie ścian')).not.toBe(key('Malowanie sufitów'))
  })

  // The owner abbreviates a j.m. differently across sheets and years, so the variants have to
  // collapse — otherwise the same praca imported from two arkusze becomes two cennik entries.
  it.each([
    ['szt', 'szt.'],
    ['m2', 'm²'],
    ['mb', 'm.b.'],
  ])('keys j.m. „%s" and „%s" the same', (plain, variant) => {
    expect(key('Malowanie ścian', plain)).toBe(key('Malowanie ścian', variant))
  })

  // The line the folding deliberately does NOT cross: a transposed or mistyped unit stays its own
  // unit. Guessing that `klp` meant `kpl` would hand the praca a price nobody compared.
  it.each([
    ['kpl', 'klp'],
    ['m2', 'n2'],
  ])('keeps j.m. „%s" and „%s" apart — typos are a human decision', (unit, typo) => {
    expect(key('Malowanie ścian', unit)).not.toBe(key('Malowanie ścian', typo))
  })

  it('keeps the same opis priced per different j.m. apart', () => {
    expect(key('Malowanie ścian', 'm2')).not.toBe(key('Malowanie ścian', 'szt'))
  })

  it('drops the section, unlike the sheet-import item key', () => {
    // The katalog is global: „Skucie tynku" is one cennik entry no matter which sekcja it sits in,
    // where the sheet-import key deliberately separates the two.
    expect(itemKey('Łazienka', 'Skucie tynku', 0)).not.toBe(itemKey('Kuchnia', 'Skucie tynku', 0))
    expect(catalogueKey('Skucie tynku', 'm2')).toBe(catalogueKey('Skucie tynku', 'm2'))
  })

  // The bug this closes: `match_key` was written stripped but READ raw, so a praca wstawiona
  // z katalogu — which keeps the note in its opis — keyed differently from the katalog row it came
  // from and reported itself as „brak w katalogu", hinting at itself.
  it('ignores the „[stary arkusz]" note — it is display text, never identity', () => {
    expect(key('Malowanie ścian [stary arkusz]')).toBe(key('Malowanie ścian'))
  })

  it('gives a missing j.m. a member of its own, so two of them collide', () => {
    // Postgres compares NULLs as distinct, so an empty half would let two „no j.m." rows both pass
    // the UNIQUE index — the token is what closes that.
    expect(key('Malowanie ścian', null)).toBe(key('Malowanie ścian', ''))
    expect(key('Malowanie ścian', null)).not.toBe(key('Malowanie ścian', 'm2'))
  })
})
