'use client'

import { useState } from 'react'
import { FolderPlus, Hammer, LibraryBig, ListChecks, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCataloguePicker } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { AddSectionsFromPresetDialog } from '@/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { copyStageSplit } from '@/lib/kosztorys/stage-split'

export function KosztorysAddMenu() {
  const {
    investmentId,
    sections,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
    stages,
    isTemplate,
  } = useKosztorysEditorContext()
  const openCataloguePicker = useCataloguePicker()
  // Owned here, OUTSIDE the dropdown content: the menu unmounts on close, so a dialog rendered inside
  // it would unmount before it could open.
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  // `stages` is ordinal-ordered, so this is the right-most etap.
  const lastStage = stages.at(-1)
  const lastPlane = lastStage?.plane

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Dodaj
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {/* No section is preselected — any default lands the praca where the user isn't looking,
              which is the whole reason this is a picker. With no sekcja to offer, „Praca" mints a
              bare one first; should the pozycja then fail, the sekcja bez pozycji left behind is a
              legitimate state, not a leak. */}
          {sections.length === 0 ? (
            <DropdownMenuItem
              onSelect={async () => {
                const sectionId = await handleAddSection()
                if (sectionId !== undefined) await handleAddItem(sectionId)
              }}
            >
              <Hammer />
              Praca
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Hammer />
                Praca
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {sections.map((section) => (
                  <DropdownMenuItem
                    key={section.sectionId}
                    onSelect={() => handleAddItem(section.sectionId)}
                  >
                    {section.sectionName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem onSelect={() => openCataloguePicker()}>
            <ListChecks />
            Praca z katalogu…
          </DropdownMenuItem>
          {/* A szablon carries no etapy, so the workbench has nothing to open one on. */}
          {/* Etapy are opened one after another for the same crew on the same terms, so a new one
              copies the last one's rozliczenie and pracownicy — both stay editable in its header.
              With nothing to copy the rozliczenie is picked here, never defaulted: it decides which
              crew's stawka prices every quantity booked into the etap. */}
          {!isTemplate &&
            (lastPlane ? (
              <DropdownMenuItem
                onSelect={() => handleAddStage(lastPlane, copyStageSplit(lastStage?.split ?? null))}
              >
                {planeIcon(lastPlane)}
                Etap
              </DropdownMenuItem>
            ) : (
              TOOL_PLANES.map((plane) => (
                <DropdownMenuItem key={plane} onSelect={() => handleAddStage(plane, null)}>
                  {planeIcon(plane)}
                  Etap — {PLANE_LABELS[plane].toLowerCase()}
                </DropdownMenuItem>
              ))
            ))}
          <DropdownMenuItem onSelect={handleAddSection}>
            <FolderPlus />
            Sekcja
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPresetDialogOpen(true)}>
            <LibraryBig />
            Sekcja z szablonu…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddSectionsFromPresetDialog
        investmentId={investmentId}
        open={presetDialogOpen}
        onOpenChange={setPresetDialogOpen}
        onAppended={handleAppendedSections}
      />
    </>
  )
}
