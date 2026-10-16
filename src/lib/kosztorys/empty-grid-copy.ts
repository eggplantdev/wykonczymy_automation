import { POLISH_GRID, type TranslatorT } from '@/lib/i18n/translations'
import { activeFilterHidesPhrase } from '@/lib/kosztorys/counted-nouns'
import { listLabels } from '@/lib/kosztorys/row-conditions/queries'
import { REPORT_UNREPORTED_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

export type EmptyGridCopyT = { title: string; description?: string }

type ArgsT = {
  preview: boolean
  /** Engaged conditions that REMOVE rows — the „Filtry" menu's unticked halves plus the client hider. */
  hiders: readonly RowConditionT[]
  /** Engaged conditions that KEEP only what they match — the toolbar's „Problemy" list. */
  diagnostics: readonly RowConditionT[]
  dictionary?: TranslatorT<'grid'>
}

/**
 * Past this many engaged hiders the sentence stops answering the question it exists for: the full set
 * of sixteen bare noun phrases runs to several hundred characters and reads as contradictions („bez
 * przedmiaru i z przedmiarem"), because the halves are complementary pairs.
 */
const MAX_NAMED_HIDERS = 3

function hidersDescription(hiders: readonly RowConditionT[]): string | undefined {
  const named = hiders.filter((condition) => condition.label !== '')
  if (named.length > MAX_NAMED_HIDERS) {
    return `${named.length} ${activeFilterHidesPhrase(named.length)} pozycje — odznacz je w menu „Filtry".`
  }
  const labels = listLabels(named)
  return labels ? `Filtr chowa pozycje ${labels}.` : undefined
}

export function emptyGridCopy({
  preview,
  hiders,
  diagnostics,
  dictionary = POLISH_GRID,
}: ArgsT): EmptyGridCopyT {
  if (preview) {
    if (hiders.some((condition) => condition.id === REPORT_UNREPORTED_CONDITION_ID)) {
      return {
        title: dictionary.t('emptyReportTitle'),
        description: dictionary.t('emptyReportDescription'),
      }
    }
    return {
      title: dictionary.t('emptyDocumentTitle'),
      description: dictionary.t('emptyDocumentDescription'),
    }
  }
  if (hiders.length > 0) {
    return { title: 'Wszystkie pozycje schowane', description: hidersDescription(hiders) }
  }
  if (diagnostics.length > 0) {
    return {
      title: `Brak pozycji ${listLabels(diagnostics, 'ani')}`,
      description: 'Filtr zrobił swoje — nie ma już czego poprawiać.',
    }
  }
  return { title: dictionary.t('emptyDocumentTitle') }
}
