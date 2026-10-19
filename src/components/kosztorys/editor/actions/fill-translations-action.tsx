'use client'

import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { countNeedingTranslation } from '@/lib/i18n/description-translations'

export function FillTranslationsMenuItem() {
  const { rows } = useKosztorysEditorContext()
  const { fillTranslations, treeRewriting } = useKosztorysActions()

  const count = countNeedingTranslation(rows)
  if (count === 0) return null

  return (
    <DropdownMenuItem onSelect={fillTranslations.start} disabled={treeRewriting}>
      <Languages />
      <MenuItemBody
        label={`Uzupełnij tłumaczenia (AI) · ${count}`}
        description="Tłumaczy brakujące i nieaktualne opisy prac oraz nazwy sekcji na języki pracowników. Ręcznie wpisane, aktualne tłumaczenia zostają bez zmian."
      />
    </DropdownMenuItem>
  )
}
