import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// A praca with no kategoria gets its own option under the empty string: without one, picking any
// kategoria would hide it with no way left to bring it back.
export function catalogueCategoryOptions(items: readonly WorkCatalogueItemT[]) {
  return [...new Set(items.map((item) => item.category ?? ''))]
    .sort((a, b) => a.localeCompare(b, 'pl'))
    .map((name) => ({ value: name, label: name || 'Bez kategorii' }))
}

// „Bez kategorii" is a filter answer, not something to type into a new praca — so the form's
// autocomplete drops the empty option the filter keeps.
export function catalogueCategorySuggestions(items: readonly WorkCatalogueItemT[]) {
  return catalogueCategoryOptions(items)
    .map((option) => option.value)
    .filter((value) => value !== '')
}
