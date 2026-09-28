import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'
import type { InvestmentRefT } from '@/types/reference-data'
import { prefilledClientName } from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import type { AcceptanceProtocolFormT } from '@/lib/kosztorys/acceptance-protocol/types'

type ClientFieldsT = Pick<AcceptanceProtocolFormT, 'clientName' | 'siteAddress'>

// `updateInvestmentAction` validates the whole investment form, so every field the protocol does not
// own is carried through — a partial payload would blank the phone, email and notes.
export function investmentUpdateFromProtocol(
  investment: InvestmentRefT,
  form: ClientFieldsT,
): InvestmentFormDataT {
  return {
    name: investment.name,
    address: form.siteAddress.trim(),
    phone: investment.phone,
    email: investment.email,
    contactPerson: form.clientName.trim(),
    notes: investment.notes,
    review: investment.review,
    status: investment.status,
    presetId: '',
  }
}

// Measured against the prefill, not the raw osoba kontaktowa: an untouched form seeded from the
// investment's name must not offer to write that name into the osoba kontaktowa.
export function hasInvestmentChanges(investment: InvestmentRefT, form: ClientFieldsT): boolean {
  return (
    form.clientName.trim() !== prefilledClientName(investment).trim() ||
    form.siteAddress.trim() !== investment.address.trim()
  )
}
