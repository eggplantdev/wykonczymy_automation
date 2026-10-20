'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { InlineLoading } from '@/components/ui/inline-loading'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { cn } from '@/lib/utils/cn'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import {
  getPresetName,
  groupPresetSections,
  isEditedTemplate,
  type PresetGroupT,
} from './preset-picker-groups'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { usePresetSections } from './use-preset-sections'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

const countItems = (group: PresetGroupT) =>
  group.metas.reduce((total, meta) => total + meta.itemCount, 0)

const summary = (sections: number, items: number) =>
  `${sections} ${sectionNoun(sections)} · ${items} ${itemNoun(items)}`

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

export function ReloadFromPresetDialog() {
  const { tree, investmentId, onTreeReplaced, isTemplate, flushPendingSaves } =
    useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().reloadPreset
  const { reloadFromPreset } = useEditorActions()
  const { sections, resetSections } = usePresetSections(open)
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const copy = COPY[isTemplate ? 'szablon' : 'kosztorys']

  const groups = groupPresetSections(sections ?? [], new Set()).filter(
    (group) => !isEditedTemplate(group.templateId, { isTemplate, investmentId }),
  )
  const {
    filteredData: filteredGroups,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(groups, getPresetName)
  const selected = groups.find((group) => group.templateId === selectedPresetId)

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
        flushPendingSaves,
        () => reloadFromPreset(investmentId, selected.templateId),
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
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName="sm:max-w-dialog"
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      pending={pending}
      pendingLabel="Wczytuję…"
      onConfirm={handleConfirm}
      confirmDisabled={!selected || pending}
    >
      {sections === null ? (
        <InlineLoading label="Ładowanie szablonów…" />
      ) : groups.length === 0 ? (
        <EmptyState size="inline" title={copy.empty} />
      ) : (
        <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-2">
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj szablonu…"
            className="w-full"
          />
          <div className={cn(BORDERED_LIST_CLASS, 'min-h-0 flex-1 overflow-y-auto')}>
            {filteredGroups.length === 0 ? (
              <EmptyState size="inline" title="Nie znaleziono szablonu." className="py-4" />
            ) : (
              filteredGroups.map((group) => {
                const isSelected = group.templateId === selectedPresetId
                return (
                  <Button
                    key={group.templateId}
                    variant="ghost"
                    size="row"
                    align="start"
                    onClick={() => setSelectedPresetId(group.templateId)}
                    aria-pressed={isSelected}
                    className={cn('rounded-none px-3 py-2 text-sm', isSelected && 'bg-accent')}
                  >
                    <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{group.templateName}</span>
                    <span className="text-muted-foreground text-xs">
                      {summary(group.metas.length, countItems(group))}
                    </span>
                  </Button>
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
    </FormDialogShell>
  )
}
