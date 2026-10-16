import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import type { CatalogueHintT } from '@/lib/kosztorys/work-catalogue/types'

export function hintLead(row: {
  description: string
  hints: readonly Pick<CatalogueHintT, 'description'>[]
}): string {
  const folded = foldDescription(row.description)
  const sameName = row.hints.every((hint) => foldDescription(hint.description) === folded)
  return sameName ? 'ta sama nazwa, inna j.m.:' : 'może chodzi o:'
}
