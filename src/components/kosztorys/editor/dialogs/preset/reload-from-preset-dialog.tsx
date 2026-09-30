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
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import { getPresetName, groupPresetSections, type PresetGroupT } from './preset-picker-groups'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { usePresetSections } from './use-preset-sections'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

const countItems = (group: PresetGroupT) =>
  group.metas.reduce((total, meta) => total + meta.itemCount, 0)

const summary = (sections: number, items: number) =>
  `${sections} ${sectionNoun(sections)} · ${items} ${itemNoun(items)}`

// The two screens' wording, side by side rather than as seven ternaries scattered down the JSX.
// Inline, the szablon variant could only be checked against the kosztorys one by reading the file
// twice; in a table each column reads top to bottom, which is how a half-updated pair shows up.
const COPY = {
  kosztorys: {
    title: 'Wczytaj kosztorys z szablonu',
    description:
      'Cała rozpiska zostanie zastąpiona — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed wczytania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.',
    empty: 'Brak zapisanych szablonów.',
    outgoing: 'Zniknie',
    incoming: 'Wejdzie',
    confirm: 'Wczytaj i zastąp',
  },
  szablon: {
    title: 'Wczytaj szablon',
    description:
      'Treść tego szablonu zostanie zastąpiona kopią wybranego — wybrany się nie zmienia. Stan sprzed wczytania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.',
    empty: 'Nie ma innego szablonu niż ten.',
    outgoing: 'Zniknie',
    incoming: 'Wejdzie',
    confirm: 'Wczytaj i zastąp',
  },
} as const

// The counterpart to „Dodaj sekcję z szablonu", which appends; this one replaces, so both counts are
// stated before the confirm. The same replace on a kosztorys and on a szablon — only the wording
// differs, because on a szablon it is that szablon's content being swapped.
export function ReloadFromPresetDialog() {
  const { tree, investmentId, onTreeReplaced, isTemplate } = useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().reloadPreset
  const { sections, resetSections } = usePresetSections(open)
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const copy = COPY[isTemplate ? 'szablon' : 'kosztorys']

  const groups = groupPresetSections(sections ?? [], new Set()).filter(
    // A szablon reloaded from itself would only lose its przedmiar — the action refuses it anyway.
    (group) => group.presetId !== investmentId,
  )
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
      const replaced = await settleTreeReplace(
        () => reloadFromPresetAction(investmentId, selected.presetId),
        'Wczytywanie przerwane — odświeżam kosztorys',
        ({ data }) => toastMessage(`Wczytano: ${summary(data.sections, data.items)}`, 'success'),
      )
      if (!replaced) return
      handleOpenChange(false)
      onTreeReplaced?.(replaced)
    })
  }

  const currentSections = tree.sections.length
  const currentItems = tree.sections.reduce((total, section) => total + section.items.length, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader title={copy.title} description={copy.description} />

        {sections === null ? (
          <p className="text-muted-foreground text-sm">Ładowanie szablonów…</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.empty}</p>
        ) : (
          <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-2">
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
          <p className="text-muted-foreground">
            {copy.outgoing}: {summary(currentSections, currentItems)}
          </p>
          <p className="text-muted-foreground">
            {copy.incoming}: {selected ? summary(selected.metas.length, countItems(selected)) : '—'}
          </p>
        </div>

        <DialogActions
          confirmLabel={copy.confirm}
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
