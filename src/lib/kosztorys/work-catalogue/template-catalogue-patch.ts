import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { ItemPatchT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

export const EMPTY_ITEM_TEXT_ERROR = 'Praca musi mieć opis i jednostkę miary.'

// What a szablon praca reads from its katalog entry (EX-1017) — a write to any of these goes to the
// entry; a szablon row stores nothing else, so every other field is dropped.
const CATALOGUE_FIELDS = [
  'description',
  'descriptionTranslations',
  'unit',
  'clientPrice',
  'wToolsOverrideValue',
  'ownToolsOverrideValue',
  'wToolsOverrideCoeff',
  'ownToolsOverrideCoeff',
] as const satisfies readonly (keyof ItemPatchT)[]

export function pickCataloguePatch(patch: ItemPatchT): ItemPatchT {
  return Object.fromEntries(
    Object.entries(patch).filter(([field]) => (CATALOGUE_FIELDS as readonly string[]).includes(field)),
  )
}

type CatalogueUpdateT = Partial<
  Pick<
    WorkCatalogueItemT,
    | 'description'
    | 'descriptionTranslations'
    | 'unit'
    | 'clientPrice'
    | 'wToolsRate'
    | 'wToolsRateCoeff'
    | 'ownToolsRate'
    | 'ownToolsRateCoeff'
    | 'matchKey'
  >
>

/**
 * The katalog update a szablon cell edit stands for. Expects the patch already made whole by
 * `normalizeOverridePatch`, so a stawka arrives as its pair and lands as the katalog's pair — the
 * same source on both sides, no `impliedCatalogueRate` derivation needed.
 *
 * `matchKey` is returned whenever the opis or j.m. is touched, so the caller can check the key's
 * holder before writing.
 */
export function catalogueUpdateFor(
  entry: WorkCatalogueItemT,
  patch: ItemPatchT,
): { data: CatalogueUpdateT } | { error: string } {
  const data: CatalogueUpdateT = {}

  if ('description' in patch || 'unit' in patch) {
    const description = ('description' in patch ? patch.description : entry.description)?.trim()
    const unit = ('unit' in patch ? patch.unit : entry.unit)?.trim()
    if (!description || !unit) return { error: EMPTY_ITEM_TEXT_ERROR }
    Object.assign(data, { description, unit, matchKey: catalogueKey(description, unit) })
  }
  if (patch.descriptionTranslations !== undefined) {
    data.descriptionTranslations = patch.descriptionTranslations
  }
  if (patch.clientPrice !== undefined) data.clientPrice = patch.clientPrice
  if ('wToolsOverrideValue' in patch) {
    data.wToolsRate = patch.wToolsOverrideValue ?? null
    data.wToolsRateCoeff = patch.wToolsOverrideCoeff ?? null
  }
  if ('ownToolsOverrideValue' in patch) {
    data.ownToolsRate = patch.ownToolsOverrideValue ?? null
    data.ownToolsRateCoeff = patch.ownToolsOverrideCoeff ?? null
  }
  return { data }
}
