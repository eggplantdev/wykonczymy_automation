'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  appendPresetSectionsAction,
  listPresetSectionsAction,
} from '@/lib/actions/kosztorys-presets'
import type { AppendedSliceT } from '@/lib/kosztorys/append-preset-sections'
import type { PresetSectionMetaT } from '@/lib/db/presets'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called with the created sections (new ids) after a successful append. The non-empty editor patches
  // the grid from this; the empty-kosztorys dialog ignores the slice and remounts via its own path.
  onAppended: (slice: AppendedSliceT) => void
}

// A meta's stable identity across all presets — a section id is only unique WITHIN its preset.
const metaKey = (meta: PresetSectionMetaT) => `${meta.presetId}:${meta.sectionId}`

// Multi-select is why this is a cmdk list, not a combobox: toggling a row keeps the dialog open and
// one confirm appends all checked sections. Fetch-on-open, mirroring seed-from-preset-button.
export function AddSectionsFromPresetDialog({
  investmentId,
  open,
  onOpenChange,
  onAppended,
}: PropsT) {
  // null = not yet loaded (distinct from [] = loaded-but-empty), so the „Brak szablonów" empty-state
  // never flashes during the fetch and a failed load isn't mistaken for a genuinely empty library.
  const [sections, setSections] = useState<PresetSectionMetaT[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)

  // Fetch-on-open: the picker can be opened programmatically (from the „Dodaj" menu item, bypassing
  // Radix's own open trigger), so syncing the load to the `open` prop is the one reliable seam. Only
  // the async list write happens here — the reset-to-null lives in the close handler (a synchronous
  // setState in an effect body is a cascading-render smell the lint forbids).
  useEffect(() => {
    if (!open) return
    void listPresetSectionsAction().then((res) => {
      if (res.success) setSections(res.data)
      else {
        setSections([])
        toastMessage(res.error ?? 'Nie udało się wczytać szablonów', 'error', 4000)
      }
    })
  }, [open])

  // Every close routes through here (cancel / esc / overlay / post-confirm), so resetting on close
  // guarantees the next open re-fetches fresh instead of showing the previous list — without an
  // in-effect setState.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(new Set())
      setSections(null)
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

  // Consecutive metas sharing a presetId form one group (the listing is already ordered that way).
  const groups: { presetId: number; presetName: string; metas: PresetSectionMetaT[] }[] = []
  for (const meta of sections ?? []) {
    const last = groups.at(-1)
    if (last && last.presetId === meta.presetId) last.metas.push(meta)
    else groups.push({ presetId: meta.presetId, presetName: meta.presetName, metas: [meta] })
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader
          className="px-4 pt-4"
          title="Dodaj sekcję z szablonu"
          description="Wybierz sekcje z zapisanych szablonów. Zostaną dodane z pracami i cenami, bez przedmiaru."
        />
        {sections === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie szablonów…</p>
        ) : sections.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Brak zapisanych szablonów.</p>
        ) : (
          <Command className="mt-3" shouldFilter>
            <CommandInput placeholder="Szukaj sekcji…" />
            <CommandList>
              <CommandEmpty>Nie znaleziono sekcji.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.presetId} heading={group.presetName}>
                  {group.metas.map((meta) => {
                    const key = metaKey(meta)
                    const isSelected = selected.has(key)
                    return (
                      <CommandItem
                        key={key}
                        value={`${meta.sectionName} ${meta.presetName} ${key}`}
                        onSelect={() => toggle(key)}
                      >
                        <Check className={cn('size-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <span className="flex-1">{meta.sectionName}</span>
                        <span className="text-muted-foreground text-xs">{meta.itemCount} poz.</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
        <DialogFooter className="px-4 pt-3 pb-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={count === 0 || pending}>
            Dodaj{count > 0 ? ` (${count})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
