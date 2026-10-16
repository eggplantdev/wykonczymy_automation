import { resolvedCurrentPlannedQty } from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { decimalText } from '@/lib/utils/decimal-text'

type CurrentPlannedRowT = { plannedQty: number; currentPlannedQty: number | null }

/**
 * The snapshot is the STORED value, null included, so undoing a first edit restores „follows"
 * rather than freezing today's ofertowy into the row.
 */
export function currentPlannedQtyPolicy<RowT extends CurrentPlannedRowT>(): CellEditPolicyT<
  RowT,
  number | null
> {
  const write = (row: RowT, value: number | null): RowT => ({ ...row, currentPlannedQty: value })
  return {
    snapshot: (row) => row.currentPlannedQty,
    sameEntry: (a, b) => a === b,
    restore: write,
    applyValue: write,
    clear: (row) => write(row, null),
    restoredLabel: (row) => decimalText(resolvedCurrentPlannedQty(row)),
  }
}
