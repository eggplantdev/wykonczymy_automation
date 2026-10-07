import { describe, expect, it } from 'vitest'
import { catalogueEntryByRowId } from '@/lib/kosztorys/work-catalogue/catalogue-entry-by-row'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const entry = (
  id: number,
  description: string,
  unit: string,
  workNote: string | null,
): WorkCatalogueItemT => ({
  id,
  description,
  descriptionTranslations: {},
  category: null,
  unit,
  clientPrice: 0,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: catalogueKey(description, unit),
  workNote,
})

const CATALOGUE = [entry(4, 'Malowanie ścian', 'm2', 'Bez gruntowania'), entry(5, 'Gładź', 'm2', null)]

describe('catalogueEntryByRowId', () => {
  it('finds the katalog entry by opis and j.m., carrying its comment', () => {
    const byRow = catalogueEntryByRowId(
      [
        { id: 1, description: '  Malowanie ścian ', unit: 'm2' },
        { id: 2, description: 'Gładź', unit: 'm2' },
      ],
      CATALOGUE,
    )

    expect(byRow.get(1)).toEqual({ id: 4, note: 'Bez gruntowania' })
    expect(byRow.get(2)).toEqual({ id: 5, note: null })
  })

  it('leaves out a row whose opis or j.m. is not in the katalog', () => {
    const byRow = catalogueEntryByRowId(
      [
        { id: 1, description: 'Malowanie ścian', unit: 'szt' },
        { id: 2, description: 'Tynkowanie', unit: 'm2' },
      ],
      CATALOGUE,
    )

    expect(byRow.size).toBe(0)
  })

  it('leaves out a row with a blank opis', () => {
    const byRow = catalogueEntryByRowId(
      [
        { id: 1, description: '   ', unit: 'm2' },
        { id: 2, description: null, unit: null },
      ],
      [...CATALOGUE, entry(6, '', 'm2', 'pusty')],
    )

    expect(byRow.size).toBe(0)
  })
})
