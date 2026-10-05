import { formatPLN } from '@/lib/utils/format-currency'
import { billsNetAmount } from '@/lib/constants/transfers'
import {
  POLISH_TRANSFERS,
  isMessageKey,
  type MessageKeyT,
  type TranslatorT,
} from '@/lib/i18n/translations'
import type { TransferRowT } from '@/types/transfers'

// Screen and paper must name a transfer identically, so the column's `cell` and its `meta.printValue`
// both read these rather than each rendering their own text.

type TransfersTranslatorT = TranslatorT<'transfers'>

const typeLabel = (type: string, { t }: TransfersTranslatorT): string => {
  const key = `type_${type}`
  return isMessageKey('transfers', key) ? t(key) : type
}

export function transferTypeText(
  { settled, type, originalType }: TransferRowT,
  translator: TransfersTranslatorT = POLISH_TRANSFERS,
): string {
  if (settled) return translator.t('settled')
  const label = typeLabel(type, translator)
  if (type === 'CANCELLATION' && originalType) {
    return translator.t('cancellationOf', { label, original: typeLabel(originalType, translator) })
  }
  return label
}

export function transferAmountText(
  { type, amount, netAmount }: TransferRowT,
  { t }: TransfersTranslatorT = POLISH_TRANSFERS,
): string {
  const gross = formatPLN(amount)
  return billsNetAmount(type) && netAmount !== null
    ? t('grossWithNet', { gross, net: formatPLN(netAmount) })
    : gross
}

export function transferVatPlaneText(
  { vatPlane }: TransferRowT,
  { t }: TransfersTranslatorT = POLISH_TRANSFERS,
): string {
  return vatPlane ? t(`plane_${vatPlane}` satisfies MessageKeyT<'transfers'>) : '—'
}

export function transferPaymentMethodText(
  { paymentMethod }: TransferRowT,
  { t }: TransfersTranslatorT = POLISH_TRANSFERS,
): string {
  return paymentMethod ? t(`payment_${paymentMethod}` satisfies MessageKeyT<'transfers'>) : '—'
}
