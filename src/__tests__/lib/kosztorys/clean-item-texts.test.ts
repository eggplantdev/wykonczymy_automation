import { describe, expect, it } from 'vitest'
import { cleanItemTexts } from '@/lib/kosztorys/clean-item-texts'

describe('cleanItemTexts', () => {
  const TYPO = 'lutowanie tasm ledowych'
  const CLEANED = 'Lutowanie taśm LED'

  it('keeps a translation current across a typo fix and leaves a stale one stale', () => {
    const [row] = cleanItemTexts([
      {
        id: 1,
        description: TYPO,
        unit: null,
        descriptionTranslations: {
          uk: { text: 'Пайка LED-стрічок', source: TYPO },
          ru: { text: 'Пайка', source: 'lutowanie' },
        },
      },
    ])

    expect(row).toMatchObject({
      description: CLEANED,
      descriptionTranslations: {
        uk: { text: 'Пайка LED-стрічок', source: CLEANED },
        ru: { text: 'Пайка', source: 'lutowanie' },
      },
    })
  })
})
