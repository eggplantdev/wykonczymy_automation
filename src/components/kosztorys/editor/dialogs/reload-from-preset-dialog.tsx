'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { reloadFromPresetAction } from '@/lib/actions/kosztorys-presets'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'
import { getPresetName, groupPresetSections, type PresetGroupT } from './preset-picker-groups'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { usePresetSections } from './use-preset-sections'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

const countItems = (group: PresetGroupT) =>
  group.metas.reduce((total, meta) => total + meta.itemCount, 0)

const summary = (sections: number, items: number) =>
  `${sections} ${sectionNoun(sections)} · ${items} ${itemNoun(items)}`

// The counterpart to „Dodaj sekcję z szablonu", which appends; this one replaces, so both counts are
// stated before the confirm.
export function ReloadFromPresetDialog() {
  const { tree, investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().reloadPreset
  const { sections, resetSections } = usePresetSections(open)
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const groups = groupPresetSections(sections ?? [], new Set())
  const {
    filteredData: filteredGroups,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(groups, getPresetName)
  const selected = groups.find((group) => group.presetId === selectedPresetId)

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetSections()
      setSelectedPresetId(null)
      setSearchTerm('')
    }
    onOpenChange(next)
  }

  function handleConfirm() {
    if (!selected) return
    startTransition(async () => {
      try {
        const result = await reloadFromPresetAction(investmentId, selected.presetId)
        if (!result.success) {
          toastMessage(result.error, 'error', 6000)
          return
        }
        toastMessage(`Wczytano: ${summary(result.data.sections, result.data.items)}`, 'success')
      } catch {
        // A transport-level rejection can arrive AFTER the transaction committed, so the grid may
        // already be rendering rows that no longer exist. Refreshing regardless is the safe read —
        // on a genuinely failed call it just re-fetches the unchanged tree.
        toastMessage('Wczytywanie przerwane — odświeżam kosztorys', 'error', 6000)
      }
      handleOpenChange(false)
      onTreeReplaced?.()
    })
  }

  const currentSections = tree.sections.length
  const currentItems = tree.sections.reduce((total, section) => total + section.items.length, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Wczytaj kosztorys z szablonu"
          description="Cała rozpiska zostanie zastąpiona — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed wczytania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
        />

        {sections === null ? (
          <p className="text-muted-foreground text-sm">Ładowanie szablonów…</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak zapisanych szablonów.</p>
        ) : (
          <div className="flex max-h-[55vh] min-h-0 flex-col gap-2">
            <SearchFilterInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Szukaj szablonu…"
              className="w-full"
            />
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              {filteredGroups.length === 0 ? (
                <p className="text-muted-foreground px-3 py-4 text-sm">Nie znaleziono szablonu.</p>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = group.presetId === selectedPresetId
                  return (
                    <button
                      key={group.presetId}
                      type="button"
                      onClick={() => setSelectedPresetId(group.presetId)}
                      aria-pressed={isSelected}
                      className={cn(
                        'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        isSelected && 'bg-accent',
                      )}
                    >
                      <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{group.presetName}</span>
                      <span className="text-muted-foreground text-xs">
                        {summary(group.metas.length, countItems(group))}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Zniknie: {summary(currentSections, currentItems)}</p>
          <p className="text-muted-foreground">
            Wejdzie: {selected ? summary(selected.metas.length, countItems(selected)) : '—'}
          </p>
        </div>

        <DialogActions
          confirmLabel="Wczytaj i zastąp"
          pending={pending}
          pendingLabel="Wczytuję…"
          onConfirm={handleConfirm}
          onCancel={() => handleOpenChange(false)}
          confirmDisabled={!selected || pending}
        />
      </DialogContent>
    </Dialog>
  )
}
