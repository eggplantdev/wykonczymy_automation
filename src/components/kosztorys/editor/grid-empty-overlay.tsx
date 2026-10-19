'use client'

import { SheetIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslation } from '@/hooks/use-translation'
import { engagedConditionsOfKind } from '@/lib/kosztorys/row-conditions/queries'
import { emptyGridCopy } from '@/lib/kosztorys/empty-grid-copy'
import { editorNoun } from '@/lib/kosztorys/editor-noun'

type PropsT = {
  isEmpty: boolean
  hasVisibleRows: boolean
  preview: boolean
  isTemplate: boolean
  search: string
  engagedConditionIds: ReadonlySet<string>
  onImport?: () => void
  onClearSearch: () => void
  onResetFilters: () => void
}

export function GridEmptyOverlay({
  isEmpty,
  hasVisibleRows,
  preview,
  isTemplate,
  search,
  engagedConditionIds,
  onImport,
  onClearSearch,
  onResetFilters,
}: PropsT) {
  const gridCopy = useTranslation('grid')
  const query = search.trim()
  const filters = engagedConditionsOfKind(engagedConditionIds, 'filter')
  const clientHiders = engagedConditionsOfKind(engagedConditionIds, 'client')
  const diagnostics = engagedConditionsOfKind(engagedConditionIds, 'diagnostic')

  if (isEmpty) {
    return (
      <EmptyState
        title={
          isTemplate
            ? `${editorNoun(isTemplate).Nominative} jest pusty`
            : gridCopy.t('emptyKosztorys')
        }
        description={preview ? undefined : 'Dodaj sekcję lub etap z menu „Dodaj" powyżej.'}
      >
        {onImport && (
          <Button variant="outline" size="sm" className="pointer-events-auto" onClick={onImport}>
            <SheetIcon />
            Pobierz z arkusza Google…
          </Button>
        )}
      </EmptyState>
    )
  }
  if (hasVisibleRows) return null
  if (query !== '') {
    return (
      <EmptyState
        title={gridCopy.t('noResults')}
        description={gridCopy.t('noResultsDescription', { query })}
      >
        <Button variant="outline" size="sm" className="pointer-events-auto" onClick={onClearSearch}>
          {gridCopy.t('clearSearch')}
        </Button>
      </EmptyState>
    )
  }
  // Gated on the RECOGNISED conditions: an id left over from a removed condition would otherwise
  // title the overlay „Brak pozycji " with nothing after it.
  if (filters.length + clientHiders.length + diagnostics.length === 0) return null
  const copy = emptyGridCopy({ preview, filters, clientHiders, diagnostics, dictionary: gridCopy })
  return (
    <EmptyState title={copy.title} description={copy.description}>
      {!preview && (
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto"
          onClick={onResetFilters}
        >
          Wyczyść filtry
        </Button>
      )}
    </EmptyState>
  )
}
