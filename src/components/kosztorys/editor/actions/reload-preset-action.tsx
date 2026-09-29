'use client'

import { FileDown } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function ReloadPresetMenuItem() {
  const { reloadPreset } = useKosztorysActions()
  const { isTemplate } = useKosztorysEditorContext()

  return (
    <DropdownMenuItem onSelect={() => reloadPreset.setOpen(true)}>
      <FileDown />
      <MenuItemBody
        label="Wczytaj szablon…"
        description={
          isTemplate
            ? 'Zastąp treść tego szablonu kopią innego.'
            : 'Zastąp całą rozpiskę zapisanym szablonem.'
        }
      />
    </DropdownMenuItem>
  )
}
