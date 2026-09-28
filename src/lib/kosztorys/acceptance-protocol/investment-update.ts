import type { InvestmentClientFieldsT } from '@/components/forms/investment-form/investment-schema'
import type { InvestmentRefT } from '@/types/reference-data'
import { prefilledClientName } from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import type { AcceptanceProtocolFormT } from '@/lib/kosztorys/acceptance-protocol/types'

type ClientFieldsT = Pick<AcceptanceProtocolFormT, 'clientName' | 'siteAddress'>

// Zamawiający seeded from the investment's name and left alone is a guess, not a contact person.
const isClientNameUntouched = (investment: InvestmentRefT, form: ClientFieldsT) =>
  form.clientName.trim() === prefilledClientName(investment).trim()

// An address-only save must not persist the guess.
export function investmentUpdateFromProtocol(
  investment: InvestmentRefT,
  form: ClientFieldsT,
): InvestmentClientFieldsT {
  return {
    contactPerson: isClientNameUntouched(investment, form)
      ? investment.contactPerson
      : form.clientName.trim(),
    address: form.siteAddress.trim(),
  }
}

// An untouched form must not offer to write the guess into the investment.
export function hasInvestmentChanges(investment: InvestmentRefT, form: ClientFieldsT): boolean {
  return (
    !isClientNameUntouched(investment, form) ||
    form.siteAddress.trim() !== investment.address.trim()
  )
}
