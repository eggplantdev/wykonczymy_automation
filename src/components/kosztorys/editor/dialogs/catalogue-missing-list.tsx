'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { formatPLN } from '@/lib/utils/format-currency'
import type {
  CatalogueHintT,
  CatalogueMissingT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

const SEARCH_RESULT_LIMIT = 8

type CatalogueNameT = { description: string; unit: string }

/**
 * „Brak w katalogu" — the prace the cennik has never heard of, each with up to three candidates it
 * might actually BE, and both ways out: take the cennik's name, or put the praca into the cennik.
 *
 * Its own component rather than `ItemList`: a candidate is a control, not a note, and the three
 * arkusz windows that share `ItemList` have nothing to click in that column.
 *
 * Accepting a candidate writes opis AND j.m., which is the whole point — the klucz is the pair, so
 * the praca only stops being „brak w katalogu" when both match. Prices stay put: this settles what
 * the praca is called, and the „Inne liczby" block it lands in is where what it costs is settled.
 */
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
  // One open search at a time, keyed by praca: the katalog runs to hundreds of wpisy and a field per
  // wiersz would filter all of them on every keystroke of any of them.
  const [searchingItemId, setSearchingItemId] = useState<number | null>(null)

  return (
    <div className="space-y-1 text-xs">
      {missing.map((row) => (
        <div key={row.itemId} className="border-border/60 space-y-1 border-t py-1">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">
              {row.section} · {row.description} ({row.unit || 'bez j.m.'})
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

          {(row.hints.length > 0 || !readOnly) && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-4 text-amber-600">
              {row.hints.length > 0 && <span>{hintLead(row)}</span>}
              {row.hints.map((hint) => (
                <CandidateButton
                  key={hint.id}
                  label={candidateLabel(hint)}
                  readOnly={readOnly}
                  onClick={() => onAcceptName(row.itemId, hintName(hint))}
                />
              ))}
              {/* Offered even with no candidates — nothing scored above the threshold is the case
                  where searching by hand is the ONLY way in. */}
              {!readOnly && (
                <Button
                  variant="link"
                  size="xs"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() =>
                    setSearchingItemId((prev) => (prev === row.itemId ? null : row.itemId))
                  }
                >
                  {row.hints.length > 0 ? 'inny…' : 'wybierz z katalogu…'}
                </Button>
              )}
            </div>
          )}

          {searchingItemId === row.itemId && (
            <CatalogueSearch
              catalogue={catalogue}
              onPick={async (entry) => {
                const saved = await onAcceptName(row.itemId, hintName(entry))
                if (saved) setSearchingItemId(null)
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

const hintName = (entry: { description: string; unit: string }): CatalogueNameT => ({
  description: entry.description,
  unit: entry.unit,
})

const candidateLabel = (entry: { description: string; unit: string; clientPrice: number }) =>
  `„${entry.description}" (${entry.unit || 'bez j.m.'}) — ${formatPLN(entry.clientPrice)}`

/**
 * 168 prace in the local dataset carry a name the cennik ALREADY has and differ only by j.m., and
 * over such a praca „może chodzi o «Montaż syfonów»" reads as the application malfunctioning. Where
 * the names fold to the same string, the sentence has to be about the j.m. instead.
 */
function hintLead(row: CatalogueMissingT): string {
  const folded = foldDescription(row.description)
  const sameName = row.hints.every((hint) => foldDescription(hint.description) === folded)
  return sameName ? 'ta sama nazwa, inna j.m.:' : 'może chodzi o:'
}

// A candidate a read-only viewer cannot accept is still worth reading — it is the explanation for
// why the praca is in this block at all.
function CandidateButton({
  label,
  readOnly,
  onClick,
}: {
  label: string
  readOnly: boolean
  onClick: () => void
}) {
  if (readOnly) return <span>{label}</span>
  return (
    <Button variant="link" size="xs" className="h-auto p-0 text-amber-600" onClick={onClick}>
      {label}
    </Button>
  )
}

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
      {/* Capped rather than scrolled: the katalog holds hundreds of wpisy, and a list that long
          inside a fold is a wall to scroll past on the way to the next praca. */}
      <div className="flex flex-col items-start gap-0.5">
        {filteredData.slice(0, SEARCH_RESULT_LIMIT).map((entry) => (
          <Button
            key={entry.id}
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => onPick(entry)}
          >
            {candidateLabel(entry)}
          </Button>
        ))}
        {filteredData.length === 0 && (
          <span className="text-muted-foreground">Nic takiego w katalogu.</span>
        )}
      </div>
    </div>
  )
}
