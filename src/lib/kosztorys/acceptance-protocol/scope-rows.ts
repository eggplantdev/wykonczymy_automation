import { formatQty } from '@/lib/kosztorys/format'
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
        description: row.description ?? '',
        qty,
        unit: row.unit ?? '',
      },
    ]
  })
}

export function scopeQuantityText(row: ProtocolScopeRowT): string {
  return [formatQty(row.qty), row.unit].filter(Boolean).join(' ')
}
