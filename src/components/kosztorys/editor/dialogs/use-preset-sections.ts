'use client'

import { getPresetSectionOptions } from '@/lib/queries/preset-pickers'
import { useListOnOpen } from '@/components/kosztorys/editor/dialogs/use-list-on-open'
import type { PresetSectionMetaT } from '@/lib/db/presets'

export function usePresetSections(open: boolean) {
  const { items, reset } = useListOnOpen<PresetSectionMetaT>(
    open,
    getPresetSectionOptions,
    'Nie udało się wczytać szablonów',
  )
  return { sections: items, resetSections: reset }
}
