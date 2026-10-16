'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { CataloguePickerTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table'
import { useCatalogueFilters } from '@/components/kosztorys/editor/hooks/use-catalogue-filters'
import { catalogueSwap } from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { unitLabel } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  catalogue: WorkCatalogueItemT[]
  kosztorysItems: readonly Pick<
    KosztorysV2RowT,
    'id' | 'sectionId' | 'description' | 'unit' | 'catalogueItemId'
  >[]
  sectionOptions: SelectOptionT[]
  initialSectionId: string
  initialSelectedId: number | undefined
  reported: { description: string; unit: string }
  onPick: (
    entry: WorkCatalogueItemT,
    sectionId: number,
    held: ReturnType<typeof catalogueSwap>,
  ) => Promise<boolean>
  onNewItem: (sectionId: number, searchTerm: string) => void
  onClose: () => void
}

export function CatalogueSwapDialog({
  catalogue,
  kosztorysItems,
  sectionOptions,
  initialSectionId,
  initialSelectedId,
  reported,
  onPick,
  onNewItem,
  onClose,
}: PropsT) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [sectionId, setSectionId] = useState(initialSectionId)
  const [isPending, setIsPending] = useState(false)
  const initialEntry = catalogue.find((entry) => entry.id === initialSelectedId)
  const { inScope, searchTerm, setSearchTerm, categories, setCategories, categoryOptions } =
    useCatalogueFilters(catalogue, initialEntry?.description)
  const selected = catalogue.find((entry) => entry.id === selectedId)
  const sectionItems = kosztorysItems.filter((item) => String(item.sectionId) === sectionId)
  const held = selected && catalogueSwap(selected, sectionItems, catalogue)
  const isInSection = held !== undefined && held.matchedItemIds.length > 0
  const isSectionMissing = sectionId === ''

  async function confirm() {
    if (!selected || !held || isSectionMissing) return
    setIsPending(true)
    const isDone = await onPick(selected, Number(sectionId), held)
    setIsPending(false)
    if (isDone) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-dialog-xl gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="px-4 pt-4" title="Dodaj pracę do rozpiski" />
        <p className="text-muted-foreground px-4 pt-1 text-sm">
          Zgłoszono: „{reported.description}” ({unitLabel(reported.unit)})
        </p>
        <div className="px-4 pt-3">
          <Label className="gap-2 text-sm font-normal">
            Do sekcji
            <SimpleSelect
              value={sectionId}
              onValueChange={setSectionId}
              options={sectionOptions}
              placeholder="Wybierz sekcję"
              className={cn('w-56', isSectionMissing && 'border-destructive')}
            />
          </Label>
        </div>
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
          <Button
            className="shrink-0"
            disabled={isSectionMissing || isPending}
            onClick={() => onNewItem(Number(sectionId), searchTerm.trim())}
          >
            Dodaj nową pracę…
          </Button>
          <p className="text-muted-foreground min-w-0 flex-1 text-right text-sm">
            {isSectionMissing
              ? 'Wybierz sekcję, do której trafi praca.'
              : selected &&
                (isInSection
                  ? 'Jest już w tej sekcji — ilość doda się do tej pozycji.'
                  : 'Trafi od razu do rozpiski jako nowa pozycja w cenie z katalogu.')}
          </p>
          <DialogActions
            className="p-0"
            confirmLabel="Dodaj"
            onConfirm={() => void confirm()}
            onCancel={onClose}
            confirmDisabled={selected === undefined || isSectionMissing}
            pending={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
