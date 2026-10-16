import { formatPLN } from '@/lib/utils/format-currency'
import { billsNetAmount, carriesPayoutStatus } from '@/lib/constants/transfers'
import {
  POLISH_TRANSFERS,
  isMessageKey,
  type MessageKeyT,
  type TranslatorT,
} from '@/lib/i18n/translations'
import type { PayoutStatusT } from '@/lib/constants/payout-confirmation'
import type { TransferRowT } from '@/types/transfers'

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

export function transferPayoutStatusText(
  { type, payoutStatus, cancelled }: TransferRowT,
  translator: TransfersTranslatorT = POLISH_TRANSFERS,
): string {
  if (!carriesPayoutStatus(type)) return ''
  return payoutStatus ? payoutStatusLabel(payoutStatus, cancelled, translator) : '—'
}

export function payoutStatusLabel(
  status: PayoutStatusT,
  cancelled: boolean,
  { t }: TransfersTranslatorT,
): string {
  return cancelled ? t('payoutCancelled') : t(`payoutStatus_${status}`)
}
