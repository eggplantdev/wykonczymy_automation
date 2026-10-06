'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { CataloguePickerTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table'
import { useCatalogueFilters } from '@/components/kosztorys/editor/hooks/use-catalogue-filters'
import {
  kosztorysCatalogueKeys,
  type KosztorysItemRefT,
} from '@/lib/kosztorys/work-catalogue/already-in-kosztorys'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { unitLabel } from '@/lib/kosztorys/format'

type PropsT = {
  catalogue: WorkCatalogueItemT[]
  kosztorysItems: readonly KosztorysItemRefT[]
  reported: { description: string; unit: string }
  onPick: (entry: WorkCatalogueItemT) => void
  onClose: () => void
}

// „Dodaj pracę z katalogu" narrowed to one praca that replaces the worker's own words. Nothing is
// hidden: a praca already in the rozpiska is the likeliest answer, and picking it adds to that pozycja.
export function CatalogueSwapDialog({
  catalogue,
  kosztorysItems,
  reported,
  onPick,
  onClose,
}: PropsT) {
  const [selectedId, setSelectedId] = useState<number | undefined>()
  const { inScope, searchTerm, setSearchTerm, categories, setCategories, categoryOptions } =
    useCatalogueFilters(catalogue)
  const selected = catalogue.find((entry) => entry.id === selectedId)
  const isInRozpiska =
    selected !== undefined && kosztorysCatalogueKeys(kosztorysItems).has(selected.matchKey)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-dialog-xl gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="px-4 pt-4" title="Podmień na pracę z katalogu" />
        <p className="text-muted-foreground px-4 pt-1 text-sm">
          Zgłoszono: „{reported.description}” ({unitLabel(reported.unit)})
        </p>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy…"
            className="min-w-0 flex-1"
          />
          <FilterMultiSelect
            values={categories}
            onValuesChange={setCategories}
            options={categoryOptions}
            label="Kategorie"
            searchable
            contentClassName="z-10001"
          />
        </div>
        {catalogue.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Katalog prac jest pusty.</p>
        ) : (
          <div className="min-h-0 px-4 pb-3">
            <CataloguePickerTable
              items={inScope}
              selectedIds={new Set(selectedId === undefined ? [] : [selectedId])}
              onToggle={(id) => setSelectedId((current) => (current === id ? undefined : id))}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
          <p className="text-muted-foreground min-w-0 text-sm">
            {selected &&
              (isInRozpiska
                ? 'Jest już w rozpisce — ilość doda się do tej pozycji.'
                : 'Nie ma jej w rozpisce — trafi tam jako nowa pozycja w cenie z katalogu.')}
          </p>
          <DialogActions
            className="p-0"
            confirmLabel="Podmień"
            onConfirm={() => {
              if (selected) onPick(selected)
              onClose()
            }}
            onCancel={onClose}
            confirmDisabled={selected === undefined}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
