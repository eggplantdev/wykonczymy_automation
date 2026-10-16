'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { CandidateRow } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row'
import { hintLead } from '@/lib/kosztorys/work-catalogue/hint-lead'
import type {
  CatalogueMissingT,
  CatalogueNameT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { unitLabel } from '@/lib/kosztorys/format'

const SEARCH_RESULT_LIMIT = 8

export function CatalogueMissingList({
  missing,
  catalogue,
  readOnly,
  onAcceptName,
  onAddToCatalogue,
}: {
  missing: readonly CatalogueMissingT[]
  catalogue: readonly WorkCatalogueItemT[]
  readOnly: boolean
  onAcceptName: (itemId: number, name: CatalogueNameT) => Promise<boolean> | boolean
  onAddToCatalogue: (itemId: number) => void
}) {
  const [searchingItemId, setSearchingItemId] = useState<number | null>(null)

  return (
    <div className="space-y-2 text-xs">
      {!readOnly && (
        <p className="text-muted-foreground">
          Kliknij podpowiedź, żeby zapisać w kosztorysie nazwę z katalogu i jednostkę. Ceny zostają
          bez zmian.
        </p>
      )}

      {missing.map((row) => (
        <div key={row.itemId} className="border-border/60 space-y-1 border-t pt-1.5 pb-1">
          <div className="flex items-start justify-between gap-3">
            <span>
              <span className="text-muted-foreground">{row.section} · </span>
              <span className="font-medium">{row.description}</span>
              <span className="text-muted-foreground"> ({unitLabel(row.unit)})</span>
            </span>
            {!readOnly && (
              <Button
                variant="link"
                size="xs"
                className="h-auto shrink-0 p-0"
                onClick={() => onAddToCatalogue(row.itemId)}
              >
                Dodaj do katalogu
              </Button>
            )}
          </div>

          {row.hints.length > 0 && <p className="text-muted-foreground pl-4">{hintLead(row)}</p>}

          <div className="pl-4">
            {row.hints.map((hint) => (
              <CandidateRow
                key={hint.id}
                entry={hint}
                readOnly={readOnly}
                onClick={() => onAcceptName(row.itemId, catalogueNameOf(hint))}
              />
            ))}
            {!readOnly && (
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground h-auto w-full justify-start gap-2 px-1 py-1 font-normal"
                onClick={() =>
                  setSearchingItemId((prev) => (prev === row.itemId ? null : row.itemId))
                }
              >
                <Search />
                {row.hints.length > 0 ? 'Inna praca z katalogu…' : 'Wybierz z katalogu…'}
              </Button>
            )}
          </div>

          {searchingItemId === row.itemId && (
            <CatalogueSearch
              catalogue={catalogue}
              onPick={async (entry) => {
                const saved = await onAcceptName(row.itemId, catalogueNameOf(entry))
                if (saved) setSearchingItemId(null)
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

const catalogueNameOf = ({
  description,
  unit,
  descriptionTranslations,
}: CatalogueNameT): CatalogueNameT => ({ description, unit, descriptionTranslations })

const searchText = (entry: WorkCatalogueItemT) => `${entry.description} ${entry.unit}`

function CatalogueSearch({
  catalogue,
  onPick,
}: {
  catalogue: readonly WorkCatalogueItemT[]
  onPick: (entry: WorkCatalogueItemT) => void
}) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter([...catalogue], searchText)

  return (
    <div className="space-y-1 pl-4">
      <SearchFilterInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Szukaj w katalogu..."
        className="w-full sm:w-72"
      />
      <div>
        {filteredData.slice(0, SEARCH_RESULT_LIMIT).map((entry) => (
          <CandidateRow
            key={entry.id}
            entry={entry}
            readOnly={false}
            onClick={() => onPick(entry)}
          />
        ))}
        {filteredData.length === 0 && (
          <span className="text-muted-foreground">Nic takiego w katalogu.</span>
        )}
      </div>
    </div>
  )
}
