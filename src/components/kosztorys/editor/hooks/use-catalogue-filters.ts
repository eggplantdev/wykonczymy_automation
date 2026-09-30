import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { catalogueCategoryOptions } from '@/lib/kosztorys/work-catalogue/category-options'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const searchText = (item: WorkCatalogueItemT) => `${item.description} ${item.category ?? ''}`

const itemCategory = (item: WorkCatalogueItemT) => item.category ?? ''

export function useCatalogueFilters(catalogue: WorkCatalogueItemT[]) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(catalogue, searchText)
  const {
    filteredData: inScope,
    values: categories,
    setValues: setCategories,
  } = useClientMultiFilter(filteredData, itemCategory)
  return {
    inScope,
    searchTerm,
    setSearchTerm,
    categories,
    setCategories,
    categoryOptions: catalogueCategoryOptions(catalogue),
  }
}
