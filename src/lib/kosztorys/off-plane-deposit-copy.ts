import {
  DEPOSIT_PLANE_INSTRUMENTAL,
  VAT_PLANE_LABELS,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import { pluralize } from '@/lib/utils/polish-plural'
import type { StrandedDepositsT } from '@/lib/kosztorys/off-plane-deposits'

export function depositNoun(count: number) {
  return pluralize(count, ['wpłata', 'wpłaty', 'wpłat'])
}

export function offPlaneDepositSentence({ count, amount }: StrandedDepositsT, mode: VatPlaneT) {
  const settledIn = VAT_PLANE_LABELS[mode].toLocaleLowerCase()
  const paidBy = DEPOSIT_PLANE_INSTRUMENTAL[mode === 'NET' ? 'GROSS' : 'NET']
  const noun = depositNoun(count)
  const verb = pluralize(count, ['jest', 'są', 'jest'])
  const lost = mode === 'GROSS' ? ` — ${formatPLN(amount)} nie spłaca nic` : ''

  return `Rozliczenie ${settledIn}, a ${count} ${noun} ${verb} ${paidBy}${lost}. Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane.`
}
