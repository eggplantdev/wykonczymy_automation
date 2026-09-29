import { applyRowConditions, clientConditionIds } from '@/lib/kosztorys/row-conditions/queries'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The pozycje a printed document actually contains: the audience's own hider and nothing else —
 * `clientConditionIds` owns which conditions may reach a reader outside the firm, and the grid's
 * plane, search and the owner's own filters are reading gestures that say nothing about what is
 * being offered.
 *
 * Takes the flag, not a settings object: the investor's and the worker's settings are separate types
 * over separate ceilings (`sanitizeClientViewSettings` / `sanitizeWorkerViewSettings`), and the only
 * thing this rule reads is the one field they share.
 *
 * Exported because the offer's caller has to know whether there is an offer BEFORE it opens a print
 * window: a kosztorys whose every pozycja is empty on both axes passes a `rows.length` guard and
 * prints a branded header over an empty table.
 */
export function documentRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  hideEmptyRows: boolean,
): KosztorysV2RowT[] {
  return applyRowConditions(rows, clientConditionIds(hideEmptyRows), {
    stages,
    hasSettledMaterial: false,
    divergentPriceRowIds: new Set(),
  })
}
