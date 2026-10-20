import { resolvedCurrentPlannedQty } from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { decimalText } from '@/lib/utils/decimal-text'

type CurrentPlannedRowT = { plannedQty: number; currentPlannedQty: number | null }

export function currentPlannedQtyPolicy<RowT extends CurrentPlannedRowT>(): CellEditPolicyT<RowT> {
  const write = (row: RowT, value: number | null): RowT => ({ ...row, currentPlannedQty: value })
  return {
    applyValue: write,
    clear: (row) => write(row, null),
    restoredLabel: (row) => decimalText(resolvedCurrentPlannedQty(row)),
  }
}
