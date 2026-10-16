import { formatPLN } from '@/lib/utils/format-currency'
import { depositNoun } from '@/lib/kosztorys/off-plane-deposit-copy'
import type { StrandedDepositsT } from '@/lib/kosztorys/off-plane-deposits'
import { pluralize } from '@/lib/utils/polish-plural'

export const INVESTOR_IMPACT_TITLE = 'Uwaga — zmiana widoczna dla inwestora!'

export const SETTLEMENT_MODE_IMPACT =
  'Sposób rozliczenia robocizny zmienia kwoty, które inwestor widzi w podglądzie.'

export const MATERIALS_PRICING_IMPACT =
  'Sposób rozliczenia materiałów zmienia kwoty, które inwestor widzi w podglądzie.'

// A warning, never a refusal (owner, 2026-08-23): the tryb is the owner's call about the deal.
export function settlementModeDepositImpact(stranded: StrandedDepositsT): string | undefined {
  if (stranded.count === 0) return undefined
  const noun = depositNoun(stranded.count)
  const verb = pluralize(stranded.count, ['przestanie', 'przestaną', 'przestanie'])
  return `${stranded.count} ${noun} gotówką (${formatPLN(stranded.amount)}) ${verb} się liczyć w rozliczeniu — jeśli klient płaci obiema drogami, wybierz rozliczenie mieszane.`
}
