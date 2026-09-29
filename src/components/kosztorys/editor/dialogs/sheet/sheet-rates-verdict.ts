import { rateNoun, rateNounDiffers } from '@/lib/kosztorys/counted-nouns'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { ReportedRateResolutionT } from '@/lib/kosztorys/sheet-import/resolve-rates'

// Which dialog is asking. The import is about to write; the comparison never writes anything, so a
// future tense there reads as a threat to save that the dialog cannot carry out.
export type RatesReportModeT = 'import' | 'compare'

/**
 * The one line above the folds, and the ORDER is the point: this is a precedence chain, not a list of
 * things that are true.
 *
 * „Żadnego cennika nie odczytaliśmy" outranks everything because nothing below it is even knowable.
 * Then the conflict, which used to lose to a drifted stawka and should not: a drifted stawka is one
 * known kwota that has moved, while a conflict means NO kwota — the praca enters at 0 zł and somebody
 * has to type it. A praca that is both keeps both clauses rather than the weaker one alone.
 */
export function ratesVerdict(
  mode: RatesReportModeT,
  decisions: ReportedRateResolutionT[] | null,
  stale: StaleRateT[],
  conflicts: number,
): string {
  if (decisions === null)
    return 'Nie odczytaliśmy żadnego cennika („zakres pracy") — o stawkach podwykonawców nic tu nie powiemy.'

  const staleClause =
    stale.length > 0
      ? `${stale.length} ${rateNounDiffers(stale.length)} od cennika w arkuszu Google — kosztorys trzyma to, co było przy pobraniu.`
      : ''

  if (conflicts > 0) {
    const conflictClause =
      mode === 'import'
        ? `Bez stawki wykonawcy wejdzie ${conflicts} ${rateNoun(conflicts)} — arkusz nie podaje dla nich jednej pewnej kwoty, więc nie wybieramy za Ciebie. Do uzupełnienia ręcznie w kosztorysie.`
        : `${conflicts} ${rateNoun(conflicts)} nie ma rozstrzygnięcia w arkuszu — nie podaje dla nich jednej pewnej kwoty, więc nie wiadomo, ile ta praca kosztuje.`
    return [conflictClause, staleClause].filter(Boolean).join(' ')
  }

  if (staleClause) return staleClause
  if (decisions.length === 0) return 'Oba cenniki podały te same stawki.'
  // What is left cannot be a disagreement — those are conflicts now. These prace simply stand in one
  // cennik, so the sentence reports where the stawka came from, not that anything was settled.
  return `${decisions.length} ${rateNoun(decisions.length)} tylko w jednym cenniku — stamtąd wzięliśmy stawkę.`
}
