import { formatPLN } from '@/lib/utils/format-currency'
import {
  TRANSFER_TYPE_LABELS,
  SETTLED_TYPE,
  PAYMENT_METHOD_LABELS,
  DEPOSIT_PLANE_LABELS,
  billsNetAmount,
} from '@/lib/constants/transfers'
import type { TransferRowT } from '@/types/transfers'

// Screen and paper must name a transfer identically, so the column's `cell` and its `meta.printValue`
// both read these derivations rather than each rendering their own text.

export function transferTypeText({ settled, type, originalType }: TransferRowT): string {
  if (settled) return SETTLED_TYPE.label
  const label = TRANSFER_TYPE_LABELS[type] ?? type
  // A cancellation names what it reversed: "Anulowanie (Wydatek inwestycyjny)".
  if (type === 'CANCELLATION' && originalType) {
    return `${label} (${TRANSFER_TYPE_LABELS[originalType] ?? originalType})`
  }
  return label
}

export function transferAmountText({ type, amount, netAmount }: TransferRowT): string {
  const gross = formatPLN(amount)
  return billsNetAmount(type) && netAmount !== null
    ? `${gross} (netto ${formatPLN(netAmount)})`
    : gross
}

export function transferVatPlaneText({ vatPlane }: TransferRowT): string {
  return vatPlane ? DEPOSIT_PLANE_LABELS[vatPlane] : '—'
}

export function transferPaymentMethodText({ paymentMethod }: TransferRowT): string {
  return paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] : '—'
}
