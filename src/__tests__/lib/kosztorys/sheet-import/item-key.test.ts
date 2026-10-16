import { describe, expect, it } from 'vitest'
import { cleanDescription, TYPO_FIXES } from '@/lib/kosztorys/clean-description'
import { foldDescription, itemKey, keyItems } from '@/lib/kosztorys/sheet-import/item-key'
import type { KosztorysItemT } from '@/lib/kosztorys/types'

const key = (description: string) => itemKey('Wyburzenia', description, 0)

const item = (id: number, description: string): KosztorysItemT => ({
  id,
  sectionId: 1,
  displayOrder: 0,
  description,
  descriptionTranslations: {},
  unit: null,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 0,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  catalogueItemId: null,
  currentPlannedQty: null,
  aiPlannedQty: null,
  changeReason: null,
  reviewStatus: null,
})

describe('itemKey', () => {
  it('keys a corrected opis the same as the typo it was written with', () => {
    expect(key('Szpachlowanie po fisnish')).toBe(key('Szpachlowanie po finish'))
    expect(key('Gniazdka na ścianch')).toBe(key('Gniazdka na ścianach'))
    expect(key('Rozdzielnia do 18modułów')).toBe(key('Rozdzielnia do 18 modułów'))
  })

  it('keys the same whether or not the opis was SHOUTED when the typo was fixed', () => {
    expect(key('GNIAZDKA NA ŚCIANCH POKOJU')).toBe(key('Gniazdka na ścianach pokoju'))
  })

  it('keys the same across case, diacritics and whitespace runs', () => {
    expect(key('Malowanie  ŚCIAN')).toBe(key('malowanie scian'))
  })

  it('keys a name the owner corrected in the katalog the same as the one the rozpiska still has', () => {
    expect(key('Lutowanie taśm ledowych')).toBe(key('Lutowanie taśm LED'))
  })

  it('stays idempotent where the raw table chained one correction into another', () => {
    // „motnaz tv" → „Montaż TV", and „montaz tv" is a key of its own — folding a second time must
    // not walk that second hop.
    expect(foldDescription(foldDescription('motnaz tv'))).toBe(foldDescription('motnaz tv'))
    expect(key('motnaz tv')).toBe(key('Montaż TV'))
  })

  it.each(TYPO_FIXES.map(([from]) => from))(
    'keys „%s" the same before and after the cleaner rewrites it',
    (typo) => {
      const before = `Wykonanie ${typo} w łazience`
      expect(key(before)).toBe(key(cleanDescription(before)))
      expect(key(before.toUpperCase())).toBe(key(cleanDescription(before.toUpperCase())))
    },
  )

  it('keeps a word-boundary rule from eating the middle of another word', () => {
    expect(key('Zabezpieczenie na wyparcie gruntu')).not.toBe(
      key('Zabezpieczenie na wypracie gruntu'),
    )
  })

  it('keeps two genuinely different opisy apart', () => {
    expect(key('Malowanie ścian')).not.toBe(key('Malowanie sufitów'))
  })

  it('keeps the section part of the identity', () => {
    expect(itemKey('Wyburzenia', 'Skucie tynku', 0)).not.toBe(itemKey('Podłogi', 'Skucie tynku', 0))
  })
})

describe('keyItems', () => {
  it('numbers repeats of one opis inside a section so both survive', () => {
    const keyed = keyItems(
      [item(1, 'Malowanie ścian'), item(2, 'Malowanie ścian')],
      () => 'Malarskie',
    )

    expect([...keyed.values()].map((entry) => entry.id)).toEqual([1, 2])
    expect(keyed.get(itemKey('Malarskie', 'Malowanie ścian', 0))?.id).toBe(1)
    expect(keyed.get(itemKey('Malarskie', 'Malowanie ścian', 1))?.id).toBe(2)
  })

  it('counts a corrected opis and its uncorrected twin as repeats of one praca', () => {
    const keyed = keyItems(
      [item(1, 'Gniazdka na ścianch'), item(2, 'Gniazdka na ścianach')],
      () => 'Elektryka',
    )

    expect(keyed.get(itemKey('Elektryka', 'Gniazdka na ścianach', 0))?.id).toBe(1)
    expect(keyed.get(itemKey('Elektryka', 'Gniazdka na ścianach', 1))?.id).toBe(2)
  })
})
