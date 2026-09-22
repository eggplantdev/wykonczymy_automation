'use client'

import { FileDown } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function ReloadPresetMenuItem() {
  const { reloadPreset } = useKosztorysActions()
  const { isWorkshop } = useKosztorysEditorContext()

  return (
    <DropdownMenuItem onSelect={() => reloadPreset.setOpen(true)}>
      <FileDown />
      <MenuItemBody
        label={isWorkshop ? 'Przełącz na inny szablon…' : 'Wczytaj szablon…'}
        description={
          isWorkshop
            ? 'Otwórz w warsztacie inny szablon. Bieżący zostaje w bibliotece.'
            : 'Zastąp całą rozpiskę zapisanym szablonem.'
        }
      />
    </DropdownMenuItem>
  )
}
