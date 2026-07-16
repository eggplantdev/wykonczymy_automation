'use client'

import { Columns3, FolderPlus, Hammer, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysAddMenu() {
  const { shownSectionIds, subtotals, handleAddItem, handleAddSection, handleAddStage } =
    useKosztorysEditorContext()

  // The new praca lands in the single shown section when the filter isolates one, else the last.
  const onlyShown = shownSectionIds?.size === 1 ? [...shownSectionIds][0] : undefined
  const addItemSectionId = onlyShown ?? subtotals.at(-1)?.sectionId ?? null

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
