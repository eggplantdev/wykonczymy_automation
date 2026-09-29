import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import type { CatalogueHintT } from '@/lib/kosztorys/work-catalogue/types'

/**
 * 168 prace in the local dataset carry a name the cennik ALREADY has and differ only by j.m., and
 * over such a praca „może chodzi o «Montaż syfonów»" reads as the application malfunctioning. Where
 * the names fold to the same string, the sentence has to be about the j.m. instead.
 */
export function hintLead(row: {
  description: string
  hints: readonly Pick<CatalogueHintT, 'description'>[]
}): string {
  const folded = foldDescription(row.description)
  const sameName = row.hints.every((hint) => foldDescription(hint.description) === folded)
  return sameName ? 'ta sama nazwa, inna j.m.:' : 'może chodzi o:'
}
