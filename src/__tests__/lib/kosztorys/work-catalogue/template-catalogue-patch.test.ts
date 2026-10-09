import { describe, expect, it } from 'vitest'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  EMPTY_ITEM_TEXT_ERROR,
  catalogueUpdateFor,
  splitTemplatePatch,
} from '@/lib/kosztorys/work-catalogue/template-catalogue-patch'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const ENTRY: WorkCatalogueItemT = {
  id: 3,
  description: 'Malowanie ścian',
  descriptionTranslations: {},
  category: null,
  unit: 'm2',
  clientPrice: 30,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: catalogueKey('Malowanie ścian', 'm2'),
  workNote: null,
}

describe('splitTemplatePatch', () => {
  it('sends the katalog its content and keeps the rest on the row', () => {
    expect(splitTemplatePatch({ clientPrice: 40, plannedQty: 2 })).toEqual({
      cataloguePatch: { clientPrice: 40 },
      rowPatch: { plannedQty: 2 },
    })
  })
})

describe('catalogueUpdateFor', () => {
  it('maps a cena to the entry without re-keying it', () => {
    expect(catalogueUpdateFor(ENTRY, { clientPrice: 40 })).toEqual({ data: { clientPrice: 40 } })
  })

  it('lands a stawka pair as the katalog pair, mode included', () => {
    expect(
      catalogueUpdateFor(ENTRY, { wToolsOverrideValue: null, wToolsOverrideCoeff: 0.4 }),
    ).toEqual({ data: { wToolsRate: null, wToolsRateCoeff: 0.4 } })
    expect(
      catalogueUpdateFor(ENTRY, { ownToolsOverrideValue: 12, ownToolsOverrideCoeff: null }),
    ).toEqual({ data: { ownToolsRate: 12, ownToolsRateCoeff: null } })
  })

  it('re-keys on a rename, reading the j.m. it did not touch off the entry', () => {
    expect(catalogueUpdateFor(ENTRY, { description: '  Gruntowanie ścian ' })).toEqual({
      data: {
        description: 'Gruntowanie ścian',
        unit: 'm2',
        matchKey: catalogueKey('Gruntowanie ścian', 'm2'),
      },
    })
  })

  it('refuses to blank the opis or the j.m.', () => {
    expect(catalogueUpdateFor(ENTRY, { description: ' ' })).toEqual({
      error: EMPTY_ITEM_TEXT_ERROR,
    })
    expect(catalogueUpdateFor(ENTRY, { unit: null })).toEqual({ error: EMPTY_ITEM_TEXT_ERROR })
  })
})
