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
 * What an empty rozpiska says about itself — title and description from one branch, so the two
 * cannot drift apart.
 *
 * The filter branch NAMES the engaged filters: a heading of only „Wszystkie pozycje schowane" leaves
 * the reader to re-open the menu and compare ticks to find which one swallowed 387 rows. The labels
 * are bare noun phrases (see `RowConditionT.label`), so they read straight after „Filtr chowa pozycje ".
 */
export function emptyGridCopy({ preview, hiders, diagnostics }: ArgsT): EmptyGridCopyT {
  if (preview) {
    return {
      title: 'Brak pozycji do pokazania',
      description: 'Żadna pozycja nie ma jeszcze przedmiaru ani wykonanej pracy.',
    }
  }
  if (hiders.length > 0) {
    const labels = listLabels(hiders.filter((condition) => condition.label !== ''))
    return {
      title: 'Wszystkie pozycje schowane',
      description: labels ? `Filtr chowa pozycje ${labels}.` : undefined,
    }
  }
  if (diagnostics.length > 0) {
    return {
      title: `Brak pozycji ${listLabels(diagnostics, 'ani')}`,
      description: 'Filtr zrobił swoje — nie ma już czego poprawiać.',
    }
  }
  // Nothing engaged, nothing to name. The render gate in `kosztorys-editor-body` happens to agree
  // and never asks — but the module stands on its own now, and the branch it would otherwise fall
  // into titles the overlay „Brak pozycji " with a trailing space and credits a filter that is off.
  return { title: 'Brak pozycji do pokazania' }
}
