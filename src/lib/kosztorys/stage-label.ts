import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { createTranslator, type TranslatorT } from '@/lib/i18n/translations'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

const POLISH_GRID = createTranslator(DEFAULT_LANGUAGE, 'grid')

// What an etap is called on screen. An empty label is as unnamed as a null one — the rename input
// commits a trimmed string, so `''` reaches here — and every surface that names an etap (the grid's
// three headers, the summary tab) has to agree, or one of them renders a blank column.
export function stageLabel(
  stage: Pick<KosztorysStageT, 'label' | 'ordinal'>,
  dictionary: TranslatorT<'grid'> = POLISH_GRID,
): string {
  return stage.label || dictionary.t('stageFallback', { ordinal: stage.ordinal })
}
