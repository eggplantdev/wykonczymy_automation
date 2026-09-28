import { CONTRACTOR_NAME } from '@/lib/kosztorys/acceptance-protocol/constants'
import type { InvestmentRefT } from '@/types/reference-data'
import type { AcceptanceProtocolFormT } from '@/lib/kosztorys/acceptance-protocol/types'

type ArgsT = {
  investment: InvestmentRefT
  today: string
}

export function protocolFormDefaults({ investment, today }: ArgsT): AcceptanceProtocolFormT {
  return {
    kind: 'final',
    place: 'Warszawa',
    issueDate: today,
    acceptanceDate: today,
    readinessDate: '',
    clientName: prefilledClientName(investment),
    contractorName: CONTRACTOR_NAME,
    siteAddress: investment.address,
    paymentDueDate: '',
  }
}

// The osoba kontaktowa is filled on a handful of investments; the name usually carries the client,
// so it is the better guess than a blank.
export function prefilledClientName(investment: InvestmentRefT): string {
  return investment.contactPerson.trim() || investment.name
}
