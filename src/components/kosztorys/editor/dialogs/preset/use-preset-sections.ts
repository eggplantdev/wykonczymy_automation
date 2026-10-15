'use client'

import { getPresetSectionOptions } from '@/lib/queries/preset-pickers'
import { useListOnOpen } from '@/components/kosztorys/editor/dialogs/preset/use-list-on-open'
import type { TemplateSectionMetaT } from '@/lib/db/templates'

export function usePresetSections(open: boolean) {
  const { items, reset } = useListOnOpen<TemplateSectionMetaT>(
    open,
    getPresetSectionOptions,
    'Nie udało się wczytać szablonów',
  )
  return { sections: items, resetSections: reset }
}
