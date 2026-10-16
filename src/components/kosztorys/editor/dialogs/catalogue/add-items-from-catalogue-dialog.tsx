'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Button } from '@/components/ui/button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { Combobox } from '@/components/ui/combobox'
import { CataloguePickerTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table'
import { useCatalogueFilters } from '@/components/kosztorys/editor/hooks/use-catalogue-filters'
import {
  createSectionWithCatalogueItemsAction,
  insertCatalogueItemsAction,
} from '@/lib/actions/catalogue-to-kosztorys'
import {
  kosztorysCatalogueRefs,
  partitionAlreadyInKosztorys,
  takenCatalogueIds,
  type KosztorysItemRefT,
} from '@/lib/kosztorys/work-catalogue/already-in-kosztorys'
import {
  resolveSectionTarget,
  sectionNameOptions,
} from '@/lib/kosztorys/work-catalogue/section-target'
import type { SectionMetaT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  investmentId: number
  catalogue: WorkCatalogueItemT[]
  sections: readonly SectionMetaT[]
  kosztorysItems: readonly KosztorysItemRefT[]
  initialSectionId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // Only the server knows
  // whether a sekcja was minted, because the nazwa may have been taken since the dialog opened.
  onInserted: (slice: AppendedCatalogueSliceT['section'], createdSection: boolean) => void
  // `sectionId` undefined = the kosztorys has no sekcja yet
  onNewItem: (sectionId: number | undefined, description: string) => void
}

const MAX_WARNING_TOASTS = 3

export function AddItemsFromCatalogueDialog({
  investmentId,
  catalogue,
  sections,
  kosztorysItems,
  initialSectionId = null,
  open,
  onOpenChange,
  onInserted,
  onNewItem,
}: PropsT) {
  const [selected, setSelected] = useState<number[]>([])
  const selectedIds = new Set(selected)
  const [sectionName, setSectionName] = useState(
    () => sections.find((section) => section.sectionId === initialSectionId)?.sectionName ?? '',
  )
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(true)
  const [pending, setPending] = useState(false)
  const [sectionHint, setSectionHint] = useState<string | undefined>()

  const { inScope, searchTerm, setSearchTerm, categories, setCategories, categoryOptions } =
    useCatalogueFilters(catalogue)

  const takenIds = takenCatalogueIds(catalogue, kosztorysCatalogueRefs(kosztorysItems))
  const { fresh, alreadyAdded } = partitionAlreadyInKosztorys(inScope, takenIds)
  // A ticked praca is never hidden, even when it is already in the kosztorys:
  // hiding it would leave it counting into „Dodaj (N)" and
  // landing in the rozpiska with no row on screen to untick.
  const keptSelected = alreadyAdded.filter((item) => selectedIds.has(item.id))
  const visible = hideAlreadyAdded ? [...fresh, ...keptSelected] : inScope
  const hiddenCount = alreadyAdded.length - keptSelected.length

  const sectionOptions = sectionNameOptions(sections)
  const target = resolveSectionTarget(sectionName, sections, initialSectionId ?? undefined)
  const canAddNew = target?.kind === 'existing' || (sections.length === 0 && !target)

  function handleNewItem() {
    if (!canAddNew) {
      setSectionHint(target ? 'Wybierz istniejącą sekcję' : 'Wybierz sekcję')
      return
    }
    onNewItem(target?.kind === 'existing' ? target.sectionId : undefined, searchTerm.trim())
  }

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAll(items: readonly WorkCatalogueItemT[]) {
    setSelected((prev) => {
      const taken = new Set(prev)
      return [...prev, ...items.map((item) => item.id).filter((id) => !taken.has(id))]
    })
  }

  async function handleConfirm() {
    if (!target || selected.length === 0) return
    setPending(true)
    // try/finally, not a bare await: a transport-level rejection never resolves to `{success:false}`, and without this
    // „Dodaj" stays disabled for good.
    let res
    let createdSection = false
    try {
      if (target.kind === 'existing') {
        res = await insertCatalogueItemsAction(target.sectionId, selected)
      } else {
        res = await createSectionWithCatalogueItemsAction(investmentId, target.name, selected)
        if (res.success) createdSection = res.data.createdSection
      }
    } catch {
      toastMessage('Nie udało się dodać prac — spróbuj ponownie', 'error', 4000)
      return
    } finally {
      setPending(false)
    }
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się dodać prac', 'error', 4000)
      return
    }
    toastMessage(selected.length === 1 ? 'Dodano pracę' : 'Dodano prace', 'success')
    for (const warning of res.data.warnings.slice(0, MAX_WARNING_TOASTS))
      toastMessage(warning, 'warning', 6000)
    const unshownWarnings = res.data.warnings.length - MAX_WARNING_TOASTS
    if (unshownWarnings > 0)
      toastMessage(`…i ${unshownWarnings} dalszych ostrzeżeń o cenie`, 'warning', 6000)
    onOpenChange(false)
    onInserted(res.data.section, createdSection)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-xl gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="px-4 pt-4" title="Dodaj pracę" />
        <div className="px-4 pt-3">
          <Combobox
            value={sectionName}
            onChange={(name) => {
              setSectionName(name)
              setSectionHint(undefined)
            }}
            options={sectionOptions}
            placeholder="Wybierz lub wpisz sekcję…"
            allowCustom
            modal
            className={cn(
              'border-input bg-background h-9 w-56 rounded-md border px-3',
              sectionHint && 'border-destructive',
            )}
            contentClassName="w-(--radix-popover-trigger-width)"
          />
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy…"
            className="min-w-0 flex-1"
          />
          <label className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
            <Checkbox
              checked={hideAlreadyAdded}
              onCheckedChange={(checked) => setHideAlreadyAdded(checked === true)}
            />
            Ukryj już dodane ({hiddenCount})
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <FilterMultiSelect
            values={categories}
            onValuesChange={setCategories}
            options={categoryOptions}
            label="Kategorie"
            searchable
          />
          <Button
            variant="outline"
            size="sm"
            disabled={visible.length === 0}
            onClick={() => selectAll(visible)}
          >
            Zaznacz widoczne ({visible.length})
          </Button>
          {!hideAlreadyAdded && (
            <Button
              variant="outline"
              size="sm"
              disabled={fresh.length === 0}
              onClick={() => selectAll(fresh)}
            >
              Zaznacz niedodane ({fresh.length})
            </Button>
          )}
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Odznacz wszystko
            </Button>
          )}
        </div>
        {catalogue.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Katalog prac jest pusty.</p>
        ) : (
          <div className="min-h-0 px-4 pb-3">
            <CataloguePickerTable items={visible} selectedIds={selectedIds} onToggle={toggle} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
          <div className="flex items-center gap-2">
            <Button onClick={handleNewItem}>Dodaj nową pracę…</Button>
            {sectionHint && <span className="text-destructive text-sm">{sectionHint}</span>}
          </div>
          <DialogActions
            className="p-0"
            confirmLabel={`Dodaj${selected.length > 0 ? ` (${selected.length})` : ''}`}
            onConfirm={() => void handleConfirm()}
            onCancel={() => onOpenChange(false)}
            confirmDisabled={selected.length === 0 || !target || pending}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
