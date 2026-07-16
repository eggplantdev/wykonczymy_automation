'use client'

import { useState } from 'react'
import { Columns3, FolderPlus, Hammer, LibraryBig, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddSectionsFromPresetDialog } from '@/components/kosztorys/add-sections-from-preset-dialog'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysAddMenu() {
  const {
    investmentId,
    shownSectionIds,
    subtotals,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
  } = useKosztorysEditorContext()
  // Owned here, OUTSIDE the dropdown content: the menu unmounts on close, so a dialog rendered inside
  // it would unmount before it could open. The item only flips this flag.
  const [pickerOpen, setPickerOpen] = useState(false)

  // The new praca lands in the single shown section when the filter isolates one, else the last.
  const onlyShown = shownSectionIds?.size === 1 ? [...shownSectionIds][0] : undefined
  const addItemSectionId = onlyShown ?? subtotals.at(-1)?.sectionId ?? null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={addItemSectionId == null}
            onSelect={() => addItemSectionId != null && handleAddItem(addItemSectionId)}
          >
            <Hammer className="size-4" />
            Praca
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleAddStage}>
            <Columns3 className="size-4" />
            Etap
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleAddSection}>
            <FolderPlus className="size-4" />
            Sekcja
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <LibraryBig className="size-4" />
            Sekcja z szablonu…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddSectionsFromPresetDialog
        investmentId={investmentId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAppended={handleAppendedSections}
      />
    </>
  )
}
