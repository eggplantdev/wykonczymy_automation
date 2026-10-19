import { describe, expect, it } from 'vitest'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'

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
