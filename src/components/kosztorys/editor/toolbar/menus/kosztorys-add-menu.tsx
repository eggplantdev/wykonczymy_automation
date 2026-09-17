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
import { AddSectionsFromPresetDialog } from '@/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PLANE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'

export function KosztorysAddMenu() {
  const {
    investmentId,
    subtotals,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
  } = useKosztorysEditorContext()
  const openCataloguePicker = useCataloguePicker()
  // Owned here, OUTSIDE the dropdown content: the menu unmounts on close, so a dialog rendered inside
  // it would unmount before it could open.
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)

  async function openPicker() {
    if (subtotals.length > 0) return openCataloguePicker()
    const sectionId = await handleAddSection()
    if (sectionId !== null) openCataloguePicker(sectionId)
  }

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
              which is the whole reason this is a picker. With no sekcja to offer, „Praca" goes
              through handleAddSection, which mints a section WITH its first pozycja inside. */}
          {subtotals.length === 0 ? (
            <DropdownMenuItem onSelect={handleAddSection}>
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
                {subtotals.map((section) => (
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
          {/* The picker needs a sekcja to land in. On an empty kosztorys one is minted first and
              handed over preselected, rather than hiding the entry and leaving the owner to guess
              that „Sekcja" is the prerequisite. */}
          <DropdownMenuItem onSelect={() => void openPicker()}>
            <ListChecks />
            Praca z katalogu…
          </DropdownMenuItem>
          {/* Plane is forced at creation — each etap plane is its own top-level item, so there is no
              plane-less „Etap" and no new stage is ever unconfirmed. The worker is deliberately NOT
              forced the same way: an unassigned etap is a legitimate resting state (it earns its own
              residual row), so it is picked later from the etap header, not here. */}
          {TOOL_PLANES.map((plane) => (
            <DropdownMenuItem key={plane} onSelect={() => handleAddStage(plane)}>
              {planeIcon(plane)}
              Etap — {PLANE_LABELS[plane].toLowerCase()}
            </DropdownMenuItem>
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
