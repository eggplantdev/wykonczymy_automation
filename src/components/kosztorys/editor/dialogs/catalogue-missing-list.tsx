'use client'

import { useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
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
 *
 * One candidate per WIERSZ, with its j.m. and cena in fixed columns. Flowing them inline turned 38
 * prace into a wall of amber prose where no candidate had a beginning, an end, or anything that
 * looked clickable — and the choice this block exists for is a comparison between candidates, which
 * is only possible when the things being compared line up.
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
    <div className="space-y-2 text-xs">
      {/* Said once, at the top: the gesture is a WRITE, and without a sentence naming it nothing on
          a candidate wiersz says what a click changes or what it leaves alone. */}
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
              <span className="text-muted-foreground"> ({row.unit || 'bez j.m.'})</span>
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
                onClick={() => onAcceptName(row.itemId, hintName(hint))}
              />
            ))}
            {/* Offered even with no candidates — nothing scored above the threshold is the case
                where searching by hand is the ONLY way in. */}
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

type CandidateEntryT = Pick<CatalogueHintT, 'description' | 'unit' | 'clientPrice'>

// The j.m. and the cena sit in their own columns, never in the sentence: candidates for one praca
// are routinely the SAME name, so those two are the whole difference between them and have to line
// up down the list to be comparable at all.
function CandidateRow({
  entry,
  readOnly,
  onClick,
}: {
  entry: CandidateEntryT
  readOnly: boolean
  onClick: () => void
}) {
  const body = (
    <>
      <span className="flex-1 text-left">{entry.description}</span>
      <span className="text-muted-foreground w-16 shrink-0 text-right">
        {entry.unit || 'bez j.m.'}
      </span>
      <span className="w-20 shrink-0 text-right tabular-nums">{formatPLN(entry.clientPrice)}</span>
    </>
  )

  // A candidate a read-only viewer cannot accept is still worth reading — it is the explanation for
  // why the praca is in this block at all.
  if (readOnly)
    return (
      <div className="flex items-baseline gap-2 px-1 py-1">
        <span className="w-4 shrink-0" />
        {body}
      </div>
    )

  return (
    <Button
      variant="ghost"
      size="xs"
      className="h-auto w-full items-baseline gap-2 px-1 py-1 font-normal"
      onClick={onClick}
    >
      {/* Amber on the glyph alone. On the whole wiersz it was 100+ amber lines in one fold, where
          the colour stopped meaning „this is the offer" and became the background. */}
      <ArrowRight className="shrink-0 self-center text-amber-600" />
      {body}
    </Button>
  )
}

const searchText = (entry: WorkCatalogueItemT) => `${entry.description} ${entry.unit}`

// No `readOnly` here: the only way to open this is the toggle that a read-only viewer never gets.
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
