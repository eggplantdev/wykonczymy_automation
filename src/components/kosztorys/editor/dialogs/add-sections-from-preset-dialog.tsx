'use client'

import { useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { appendPresetSectionsAction } from '@/lib/actions/kosztorys-presets'
import { useSearchFilter } from '@/hooks/use-search-filter'
import type { AppendedSliceT } from '@/lib/kosztorys/append-preset-sections'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'
import {
  getPresetName,
  groupPresetSections,
  isGroupFullySelected,
  metaKey,
} from './preset-picker-groups'
import { sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { usePresetSections } from './use-preset-sections'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // The editor patches the grid from this rather than refetching the tree.
  onAppended: (slice: AppendedSliceT) => void
}

// Selection is cumulative across szablony and confirms once.
export function AddSectionsFromPresetDialog({
  investmentId,
  open,
  onOpenChange,
  onAppended,
}: PropsT) {
  const { sections, resetSections } = usePresetSections(open)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  // Below `sm` (48rem — this repo overrides the scale) only one pane fits, so this drives which of
  // the two is shown. Both stay mounted at every width — above `sm` the state is inert.
  const [pane, setPane] = useState<'presets' | 'sections'>('presets')
  const [pending, setPending] = useState(false)

  const groups = groupPresetSections(sections ?? [], selected)
  const {
    filteredData: filteredGroups,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(groups, getPresetName)
  // Falling back to the first szablon keeps the right pane filled from the moment the list lands,
  // without an effect that writes state during render. `.at(0)` rather than `[0]`: it types as
  // `| undefined`, so the empty-library case can't be read past without narrowing first.
  const activeGroup = groups.find((group) => group.presetId === activePresetId) ?? groups.at(0)

  // Every close routes through here (cancel / esc / overlay / post-confirm), so resetting on close
  // guarantees the next open re-fetches fresh instead of showing the previous list — without an
  // in-effect setState.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(new Set())
      resetSections()
      setActivePresetId(null)
      setPane('presets')
      setSearchTerm('')
    }
    onOpenChange(next)
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Loading a whole szablon into an empty kosztorys is the common case, so it stays one click.
  function toggleGroup(keys: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (keys.every((key) => next.has(key))) keys.forEach((key) => next.delete(key))
      else keys.forEach((key) => next.add(key))
      return next
    })
  }

  async function handleConfirm() {
    const selections = (sections ?? [])
      .filter((meta) => selected.has(metaKey(meta)))
      .map((meta) => ({ presetId: meta.presetId, sectionId: meta.sectionId }))
    if (selections.length === 0) return
    setPending(true)
    const res = await appendPresetSectionsAction(investmentId, selections)
    setPending(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się dodać sekcji', 'error', 4000)
      return
    }
    toastMessage(selections.length === 1 ? 'Dodano sekcję' : 'Dodano sekcje', 'success')
    handleOpenChange(false)
    onAppended(res.data)
  }

  const count = selected.size
  const allActiveSelected = isGroupFullySelected(activeGroup)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl sm:p-0">
        <DialogHeader
          className="px-4 pt-4"
          title="Dodaj sekcję z szablonu"
          description="Wybierz sekcje z zapisanych szablonów. Zostaną dodane z pracami i cenami, bez przedmiaru."
        />
        {sections === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie szablonów…</p>
        ) : !activeGroup ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Brak zapisanych szablonów.</p>
        ) : (
          <div className="mt-3 flex max-h-[55vh] min-h-0 border-t">
            <div
              className={cn(
                'w-full flex-col sm:flex sm:w-1/2',
                pane === 'presets' ? 'flex' : 'hidden',
              )}
            >
              <div className="p-2">
                <SearchFilterInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Szukaj szablonu…"
                  className="w-full"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredGroups.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-sm">
                    Nie znaleziono szablonu.
                  </p>
                ) : (
                  filteredGroups.map((group) => (
                    <button
                      key={group.presetId}
                      type="button"
                      // Ticking a whole szablon goes through „Zaznacz wszystkie", not this row.
                      onClick={() => {
                        setActivePresetId(group.presetId)
                        setPane('sections')
                      }}
                      aria-current={group.presetId === activeGroup.presetId}
                      className={cn(
                        'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        group.presetId === activeGroup.presetId && 'bg-accent',
                      )}
                    >
                      <span className="flex-1 truncate">{group.presetName}</span>
                      {group.selectedCount > 0 && (
                        <span className="text-primary text-xs font-medium">
                          {group.selectedCount}/{group.metas.length}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {group.metas.length} {sectionNoun(group.metas.length)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div
              className={cn(
                'w-full flex-col sm:flex sm:w-1/2 sm:border-l',
                pane === 'sections' ? 'flex' : 'hidden',
              )}
            >
              {/* The name shows at every width, not only as the drill-in's back label: with the left
                pane filtered, the highlighted row can be off-screen, and „Zaznacz wszystkie" must
                never be ambiguous about which szablon it fills. */}
              <button
                type="button"
                onClick={() => setPane('presets')}
                className="hover:bg-accent flex items-center gap-1 border-b px-3 py-2 text-left text-sm sm:hidden"
              >
                <ChevronLeft />
                <span className="truncate">{activeGroup.presetName}</span>
              </button>
              <p className="hidden truncate border-b px-3 py-2 text-sm font-medium sm:block">
                {activeGroup.presetName}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto py-2">
                {/* Lives in the unfiltered pane by construction: mass-select can never reach sekcje
                  the user cannot see. */}
                <button
                  type="button"
                  onClick={() => toggleGroup(activeGroup.metas.map(metaKey))}
                  aria-pressed={allActiveSelected}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <Check className={cn(allActiveSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-muted-foreground flex-1 text-xs">
                    {allActiveSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  </span>
                </button>
                {activeGroup.metas.map((meta) => {
                  const key = metaKey(meta)
                  const isSelected = selected.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      aria-pressed={isSelected}
                      className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{meta.sectionName}</span>
                      <span className="text-muted-foreground text-xs">{meta.itemCount} poz.</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        <DialogActions
          className="px-4 pt-3 pb-4"
          confirmLabel={`Dodaj${count > 0 ? ` (${count})` : ''}`}
          onConfirm={() => void handleConfirm()}
          onCancel={() => handleOpenChange(false)}
          confirmDisabled={count === 0 || pending}
        />
      </DialogContent>
    </Dialog>
  )
}
