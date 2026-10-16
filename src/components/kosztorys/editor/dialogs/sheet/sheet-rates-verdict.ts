import { rateNoun, rateNounDiffers } from '@/lib/kosztorys/counted-nouns'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { ReportedRateResolutionT } from '@/lib/kosztorys/sheet-import/resolve-rates'

export type RatesReportModeT = 'import' | 'compare'

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
  return `${decisions.length} ${rateNoun(decisions.length)} tylko w jednym cenniku — stamtąd wzięliśmy stawkę.`
}
