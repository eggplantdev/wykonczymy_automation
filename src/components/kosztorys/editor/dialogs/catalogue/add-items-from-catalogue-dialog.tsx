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

type PropsT = {
  investmentId: number
  catalogue: WorkCatalogueItemT[]
  sections: readonly SectionMetaT[]
  // The WHOLE rozpiska, so „Ukryj już dodane" answers for the kosztorys and not for one sekcja —
  // the same praca legitimately sits in several pokoje, and the owner wants all of them out of view.
  kosztorysItems: readonly KosztorysItemRefT[]
  // Set when the picker was opened from a row's menu — that row's section is the answer already.
  initialSectionId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // The editor patches the grid from this rather than refetching the tree. Only the server knows
  // whether a sekcja was minted, because the nazwa may have been taken since the dialog opened.
  onInserted: (slice: AppendedCatalogueSliceT['section'], createdSection: boolean) => void
}

const MAX_WARNING_TOASTS = 3

// Selection is ordered, not a Set: the prace land in the rozpiska in the order they were ticked,
// which sorting the table does not touch.
export function AddItemsFromCatalogueDialog({
  investmentId,
  catalogue,
  sections,
  kosztorysItems,
  initialSectionId = null,
  open,
  onOpenChange,
  onInserted,
}: PropsT) {
  // Ordered in state, because the prace land in the rozpiska in the order they were ticked; a Set
  // beside it for membership, which is asked once per visible row and once per already-added row —
  // `includes` over the whole cennik made that quadratic on a „zaznacz widoczne".
  const [selected, setSelected] = useState<number[]>([])
  const selectedIds = new Set(selected)
  const [sectionName, setSectionName] = useState(
    () => sections.find((section) => section.sectionId === initialSectionId)?.sectionName ?? '',
  )
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(true)
  const [pending, setPending] = useState(false)

  const { inScope, searchTerm, setSearchTerm, categories, setCategories, categoryOptions } =
    useCatalogueFilters(catalogue)

  // Cached on the rozpiska alone, so a keystroke in the szukajka costs Set lookups and not a re-fold
  // of the whole kosztorys.
  const takenIds = takenCatalogueIds(catalogue, kosztorysCatalogueRefs(kosztorysItems))
  // Split AFTER the szukajka, so the „(N)" counts what this phrase is hiding rather than the whole
  // cennik — a number about rows the owner cannot see anyway would read as a defect.
  const { fresh, alreadyAdded } = partitionAlreadyInKosztorys(inScope, takenIds)
  // A ticked praca is never hidden, even when it is already in the kosztorys: the owner reached it by
  // unchecking the switch on purpose, and hiding it would leave it counting into „Dodaj (N)" and
  // landing in the rozpiska with no row on screen to untick.
  const keptSelected = alreadyAdded.filter((item) => selectedIds.has(item.id))
  const visible = hideAlreadyAdded ? [...fresh, ...keptSelected] : inScope
  const hiddenCount = alreadyAdded.length - keptSelected.length

  const sectionOptions = sectionNameOptions(sections)
  const target = resolveSectionTarget(sectionName, sections, initialSectionId ?? undefined)

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Appended, never replaced: a bulk button adds to what is already ticked, so the owner can sweep
  // one kategoria, switch to the next and keep both.
  function selectAll(items: readonly WorkCatalogueItemT[]) {
    setSelected((prev) => {
      const taken = new Set(prev)
      return [...prev, ...items.map((item) => item.id).filter((id) => !taken.has(id))]
    })
  }

  async function handleConfirm() {
    if (!target || selected.length === 0) return
    setPending(true)
    // try/finally, not a bare await: a transport-level rejection (dropped connection, a client still
    // holding a redeployed build's action id) never resolves to `{success:false}`, and without this
    // „Dodaj" stays disabled for good with nothing said on screen.
    let res
    // Read off the branch that knows, not sniffed back off the result: only the „nowa sekcja" action
    // can report one, and only the server can say whether the nazwa turned out to be taken.
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
    // Warned, not refused: a katalog price the owner entered on purpose still goes in, but he is told
    // which praca crossed the ceiling. Capped, because a hurtowe zaznaczenie can cross the ceiling on
    // hundreds of prace at once and a wall of toasts says less than three of them plus a count.
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
      {/* Widest of the editor's windows: seven columns of cennik, and the kategoria is what the eye
          picks a praca out by — clipped, it stops being a column and becomes noise. */}
      <DialogContent className="sm:max-w-dialog-xl gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="px-4 pt-4" title="Dodaj pracę z katalogu" />
        <div className="flex items-center gap-4 px-4 py-3">
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy…"
            className="min-w-0 flex-1"
          />
          {/* Hidden, never removed: a praca that silently vanishes from the cennik reads as a gap in
              the katalog, so the count stays on screen and the switch stays reachable. */}
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
          {/* Only while the switch is off: with it on, „widoczne" IS the niedodane, and two buttons
              doing one thing read as two different things. */}
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
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground shrink-0 text-sm">Dodaj do:</span>
            <Combobox
              value={sectionName}
              onChange={setSectionName}
              options={sectionOptions}
              placeholder="Wybierz lub wpisz sekcję…"
              allowCustom
              modal
              className="border-input bg-background h-9 w-56 rounded-md border px-3"
              contentClassName="w-(--radix-popover-trigger-width)"
            />
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
