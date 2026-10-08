import { describe, expect, it } from 'vitest'
import {
  itemFromFields,
  withCatalogueFields,
  type ItemFieldsT,
} from '@/lib/kosztorys/item-from-fields'

describe('itemFromFields', () => {
  it('carries the katalog translations onto the new pozycja together with the opis', () => {
    const descriptionTranslations = {
      uk: { text: 'Фарбування стін', source: 'Malowanie ścian' },
      ru: { text: 'Покраска стен', source: 'Malowanie ścian' },
    }
    const item = itemFromFields(
      {
        description: 'Malowanie ścian',
        descriptionTranslations,
        unit: 'm2',
        clientPrice: 30,
        wToolsRate: null,
        ownToolsRate: null,
        wToolsRateCoeff: null,
        ownToolsRateCoeff: null,
      },
      7,
      3,
      null,
    )
    expect(item).toMatchObject({
      sectionId: 7,
      displayOrder: 3,
      description: 'Malowanie ścian',
      descriptionTranslations,
    })
  })
})

describe('withCatalogueFields', () => {
  const own = itemFromFields(
    {
      description: 'Stary opis',
      descriptionTranslations: {},
      unit: 'szt',
      clientPrice: 10,
      wToolsRate: 4,
      ownToolsRate: null,
      wToolsRateCoeff: null,
      ownToolsRateCoeff: 0.5,
    },
    1,
    0,
    9,
  )

  const entry: ItemFieldsT = {
    description: 'Malowanie ścian',
    descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
    unit: 'm2',
    clientPrice: 30,
    // One plane auto, the other a mnożnik — each arrives in the entry's mode, not the row's.
    wToolsRate: null,
    wToolsRateCoeff: null,
    ownToolsRate: null,
    ownToolsRateCoeff: 0.4,
  }

  it('shows a linked szablon row as its katalog entry', () => {
    expect(withCatalogueFields(own, entry)).toMatchObject({
      description: 'Malowanie ścian',
      descriptionTranslations: entry.descriptionTranslations,
      unit: 'm2',
      clientPrice: 30,
      wToolsOverrideValue: null,
      wToolsOverrideCoeff: null,
      ownToolsOverrideValue: null,
      ownToolsOverrideCoeff: 0.4,
    })
  })

  it('carries a kwota stała across as a kwota', () => {
    expect(withCatalogueFields(own, { ...entry, wToolsRate: 12 })).toMatchObject({
      wToolsOverrideValue: 12,
      wToolsOverrideCoeff: null,
    })
  })

  it('leaves the row its own values when there is no entry to show', () => {
    expect(withCatalogueFields(own, null)).toBe(own)
  })

  it('keeps what belongs to the row', () => {
    const overlaid = withCatalogueFields({ ...own, plannedQty: 7, note: 'x' }, entry)
    expect(overlaid).toMatchObject({ catalogueItemId: 9, plannedQty: 7, note: 'x' })
  })
})
