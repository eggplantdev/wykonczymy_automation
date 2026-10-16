import { POLISH_GRID, type TranslatorT } from '@/lib/i18n/translations'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// An empty label is as unnamed as a null one — the rename input commits a trimmed string, so `''`
// reaches here.
export function stageLabel(
  stage: Pick<KosztorysStageT, 'label' | 'ordinal'>,
  dictionary: TranslatorT<'grid'> = POLISH_GRID,
): string {
  return stage.label || dictionary.t('stageFallback', { ordinal: stage.ordinal })
}
