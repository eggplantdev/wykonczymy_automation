import { activeFilterHidesPhrase } from '@/lib/kosztorys/counted-nouns'
import { listLabels } from '@/lib/kosztorys/row-conditions/queries'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

export type EmptyGridCopyT = { title: string; description?: string }

type ArgsT = {
  preview: boolean
  /** Engaged conditions that REMOVE rows — the „Filtry" menu's unticked halves plus the client hider. */
  hiders: readonly RowConditionT[]
  /** Engaged conditions that KEEP only what they match — the toolbar's „Problemy" list. */
  diagnostics: readonly RowConditionT[]
}

/**
 * Past this many engaged hiders the sentence stops answering the question it exists for: the full set
 * of sixteen bare noun phrases runs to several hundred characters and reads as contradictions („bez
 * przedmiaru i z przedmiarem"), because the halves are complementary pairs. „Odznacz wszystkie"
 * reaches that state in one gesture, so it is the common case, not the tail.
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

/**
 * Title and description come from one branch so the two cannot drift apart. The filter branch NAMES
 * the engaged filters — „Wszystkie pozycje schowane" alone leaves the reader re-opening the menu to
 * find which tick swallowed 387 rows. The labels are bare noun phrases (`RowConditionT.label`), so
 * they read straight after „Filtr chowa pozycje ". Past `MAX_NAMED_HIDERS` the count replaces the
 * list — it still says where to go, which is all the naming ever bought.
 */
export function emptyGridCopy({ preview, hiders, diagnostics }: ArgsT): EmptyGridCopyT {
  if (preview) {
    return {
      title: 'Brak pozycji do pokazania',
      description: 'Żadna pozycja nie ma jeszcze przedmiaru ani wykonanej pracy.',
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
  // Nothing engaged, nothing to name. `kosztorys-editor-body` never asks, but without this branch the
  // overlay reads „Brak pozycji " with a trailing space and credits a filter that is off.
  return { title: 'Brak pozycji do pokazania' }
}
