import { POLISH_GRID, type TranslatorT } from '@/lib/i18n/translations'
import { activeFilterNarrowsPhrase } from '@/lib/kosztorys/counted-nouns'
import { listLabels } from '@/lib/kosztorys/row-conditions/queries'
import { REPORT_UNREPORTED_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

export type EmptyGridCopyT = { title: string; description?: string }

type ArgsT = {
  preview: boolean
  /** The „Filtry" menu's ticks — each narrows the grid to what it matches. */
  filters: readonly RowConditionT[]
  /** Engaged conditions that REMOVE what they match — the client document's hiders. */
  clientHiders: readonly RowConditionT[]
  /** Engaged conditions that KEEP only what they match — the toolbar's „Problemy" list. */
  diagnostics: readonly RowConditionT[]
  dictionary?: TranslatorT<'grid'>
}

/** Past this many ticks the list of noun phrases runs too long to answer „why is the grid empty". */
const MAX_NAMED_FILTERS = 3

function filtersDescription(filters: readonly RowConditionT[]): string | undefined {
  const named = filters.filter((condition) => condition.label !== '')
  if (named.length > MAX_NAMED_FILTERS) {
    return `${named.length} ${activeFilterNarrowsPhrase(named.length)} pozycje — zmień je w menu „Filtry".`
  }
  const labels = listLabels(named)
  return labels ? `Filtry pokazują tylko pozycje ${labels}.` : undefined
}

export function emptyGridCopy({
  preview,
  filters,
  clientHiders,
  diagnostics,
  dictionary = POLISH_GRID,
}: ArgsT): EmptyGridCopyT {
  if (preview) {
    if (clientHiders.some((condition) => condition.id === REPORT_UNREPORTED_CONDITION_ID)) {
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
  if (filters.length > 0) {
    return { title: 'Brak pozycji spełniających filtry', description: filtersDescription(filters) }
  }
  if (diagnostics.length > 0) {
    return {
      title: `Brak pozycji ${listLabels(diagnostics, 'ani')}`,
      description: 'Filtr zrobił swoje — nie ma już czego poprawiać.',
    }
  }
  return { title: dictionary.t('emptyDocumentTitle') }
}
