import { formatPLN } from '@/lib/utils/format-currency'
import { depositNoun } from '@/lib/kosztorys/off-plane-deposit-copy'
import type { StrandedDepositsT } from '@/lib/kosztorys/off-plane-deposits'
import { pluralize } from '@/lib/utils/polish-plural'

// One title for every setting whose consequence lands on the investor's link, because the mistake it
// catches is the same each time: a misclick in a picker whose consequence isn't on the screen the
// picker sits on. Shared so the wording can't drift between the controls that raise it.
export const INVESTOR_IMPACT_TITLE = 'Uwaga — zmiana widoczna dla inwestora!'

export const SETTLEMENT_MODE_IMPACT =
  'Sposób rozliczenia robocizny zmienia kwoty, które inwestor widzi w podglądzie.'

export const MATERIALS_PRICING_IMPACT =
  'Sposób rozliczenia materiałów zmienia kwoty, które inwestor widzi w podglądzie.'

// Appended to SETTLEMENT_MODE_IMPACT when the tryb being chosen is one those wpłaty do not survive.
// A warning, never a refusal (owner, 2026-08-23): the tryb is the owner's call about the deal, and
// blocking it because of how money already came in would let the wpłaty dictate the deal. What it
// owes him is the kwota, before he presses — the damage is silent afterwards, since nothing is
// rewritten and the rows just stop counting.
export function settlementModeDepositImpact(stranded: StrandedDepositsT): string | undefined {
  if (stranded.count === 0) return undefined
  const noun = depositNoun(stranded.count)
  const verb = pluralize(stranded.count, ['przestanie', 'przestaną', 'przestanie'])
  return `${stranded.count} ${noun} gotówką (${formatPLN(stranded.amount)}) ${verb} się liczyć w rozliczeniu — jeśli klient płaci obiema drogami, wybierz rozliczenie mieszane.`
}
