import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { ProtocolScopeRowT } from '@/lib/kosztorys/acceptance-protocol/types'

// Pomiar z natury IS the stage sum, so a pozycja is on the protocol exactly when some etap executed it.
export function protocolScopeRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): ProtocolScopeRowT[] {
  return rows.flatMap((row) => {
    const qty = rowTotalQtyDone(row, stages, 'client')
    if (qty <= 0) return []
    return [
      {
        sectionName: row.sectionName,
        description: row.description ?? '',
        qty,
        unit: row.unit ?? '',
      },
    ]
  })
}
