import { PROBLEM_CONDITIONS } from '@/lib/kosztorys/problem-conditions'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

// What clicking the chip's X undoes. Named rather than carrying a callback, so this module stays free
// of the editor's handlers and the bar keeps the one place that knows how each source is switched off.
export type ChipRemovalT = 'condition' | 'problem' | 'sections' | 'search'

export type ActiveFilterChipT = {
  // The condition id where there is one; a fixed key otherwise. Also the React key.
  id: string
  label: string
  // Across the whole kosztorys, never over the survivors — a chip whose number counted what its own
  // filter left standing would move every time anything else was ticked.
  count?: number
  // What the X undoes, in the imperative — built from the bare name rather than from `label`, whose
  // „Ukryto:" / „Tylko:" prefix would read back as „Usuń: Ukryto: …".
  removeLabel: string
  removal: ChipRemovalT
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  collapsedSectionCount: number
  search: string
  counts: ReadonlyMap<string, number>
}

/**
 * Everything currently hiding pozycje, as one ordered list — the whole content of the active-filters
 * bar, away from the markup.
 *
 * It names EVERY source, not just the „Filtry" menu's. A bar that reported half of them would say
 * „nothing is filtered" while the grid was still short, which is worse than no bar: the counters on
 * the triggers at least never claimed to be the whole story.
 *
 * The wording carries the direction, because the two kinds pull opposite ways and a bare label cannot
 * say which: a filter is ENGAGED by unticking it, so it REMOVES its matches („Ukryto: …"), while a
 * problem is pressed and KEEPS only its matches („Tylko: …"). The menu can leave this implicit — a
 * tick means visible — but out here there is no tick to read.
 *
 * `kind: 'client'` conditions can never appear: they are engaged by the investment's stored client-view
 * settings rather than by a reading gesture, and the toolbar this bar lives in is not rendered under
 * the preview at all. Offering an owner an X for one would be offering to edit a saved setting from a
 * control that undoes gestures.
 */
export function activeFiltersModel({
  engagedIds,
  collapsedSectionCount,
  search,
  counts,
}: ArgsT): ActiveFilterChipT[] {
  const chips: ActiveFilterChipT[] = []

  // Registry order, the same order the „Filtry" menu lists them in — the bar and the menu are two
  // readings of one set, so they must not sort it differently.
  for (const condition of ROW_CONDITIONS) {
    if (condition.kind !== 'filter' || !engagedIds.has(condition.id)) continue
    chips.push({
      id: condition.id,
      label: `Ukryto: pozycje ${condition.label}`,
      removeLabel: `Pokaż z powrotem pozycje ${condition.label}`,
      count: counts.get(condition.id) ?? 0,
      removal: 'condition',
    })
  }

  // At most one, by construction: every „Problemy" row picks exclusively. Written as a loop anyway
  // rather than a `find`, so the bar does not quietly drop a second one if that ever changes.
  for (const problem of PROBLEM_CONDITIONS) {
    if (!engagedIds.has(problem.id)) continue
    // `problem.sentence` is deliberately not used: it is a three-line explanation of an
    // investment-wide fact, which is a paragraph, not a chip. The noun phrase still identifies it.
    chips.push({
      id: problem.id,
      label: `Tylko: ${problem.noun.toLowerCase()} ${problem.label}`,
      removeLabel: `Przestań pokazywać tylko ${problem.noun.toLowerCase()} ${problem.label}`,
      count: counts.get(problem.id) ?? 0,
      removal: 'problem',
    })
  }

  // One chip for all of them, never one per section: folding is done in bulk from the „Sekcje" list,
  // so a kosztorys with thirty sections would otherwise flood the bar with thirty chips and bury the
  // filters they were meant to sit beside.
  if (collapsedSectionCount > 0) {
    chips.push({
      id: 'collapsed-sections',
      label: 'Zwinięte sekcje',
      removeLabel: 'Rozwiń wszystkie sekcje',
      count: collapsedSectionCount,
      removal: 'sections',
    })
  }

  // No count: the search runs over the rows as they are typed and matches whatever it matches, so
  // there is no whole-dataset figure to put here that would not be a count of the survivors.
  if (search.trim() !== '') {
    chips.push({
      id: 'search',
      label: `Szukaj: „${search}"`,
      removeLabel: 'Wyczyść wyszukiwanie',
      removal: 'search',
    })
  }

  return chips
}
