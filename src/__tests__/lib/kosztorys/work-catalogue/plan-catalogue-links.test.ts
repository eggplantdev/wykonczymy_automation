import { describe, it, expect } from 'vitest'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  planCatalogueLinks,
  type LinkRowT,
} from '@/lib/kosztorys/work-catalogue/plan-catalogue-links'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const entry: WorkCatalogueItemT = {
  id: 7,
  description: 'Gładzie',
  descriptionTranslations: { uk: { text: 'Шпаклівка', source: 'Gładzie' } },
  category: 'Ściany',
  unit: 'm2',
  clientPrice: 40,
  wToolsRate: 20,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: catalogueKey('Gładzie', 'm2'),
  workNote: null,
}

const row = (extra: Partial<LinkRowT['source']> = {}, isTemplate = true): LinkRowT => ({
  itemId: 1,
  investmentName: 'Kosztorys 2026 kolory',
  isTemplate,
  source: {
    description: 'Gładzie',
    descriptionTranslations: { uk: { text: 'Шпаклівка', source: 'Gładzie' } },
    unit: 'm2',
    sectionName: '1. Salon',
    clientPrice: 40,
    wToolsOverrideValue: 20,
    ownToolsOverrideValue: null,
    wToolsOverrideCoeff: null,
    ownToolsOverrideCoeff: null,
    ...extra,
  },
})

describe('planCatalogueLinks', () => {
  it('links a szablon row identical to its katalog entry', () => {
    expect(planCatalogueLinks([row()], [entry]).links).toEqual([{ itemId: 1, catalogueItemId: 7 }])
  })

  // Same kwota today, different rodzaj: a mnożnik moves with the cena, a kwota does not.
  it('reports a szablon row whose stawka differs only in mode, and does not link it', () => {
    const plan = planCatalogueLinks(
      [row({ clientPrice: 40, wToolsOverrideValue: null, wToolsOverrideCoeff: 0.5 })],
      [entry],
    )
    expect(plan.links).toEqual([])
    expect(plan.templateMismatches).toEqual([
      expect.objectContaining({ itemId: 1, fields: ['stawka z narzędziami'] }),
    ])
  })

  it('links a kosztorys row on opis + j.m. even with its own cena', () => {
    const plan = planCatalogueLinks([row({ clientPrice: 55 }, false)], [entry])
    expect(plan.links).toEqual([{ itemId: 1, catalogueItemId: 7 }])
  })

  it('leaves a row with no katalog entry for its opis + j.m. unlinked', () => {
    const plan = planCatalogueLinks([row({ description: 'Tapetowanie' }, false)], [entry])
    expect(plan.links).toEqual([])
    expect(plan.unmatched).toHaveLength(1)
  })
})
