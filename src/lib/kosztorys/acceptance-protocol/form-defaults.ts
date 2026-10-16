import { CONTRACTOR_NAME } from '@/lib/kosztorys/acceptance-protocol/constants'
import { formatAddress, formatBillingParty } from '@/lib/investments/format-address'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import type { AcceptanceProtocolFormT } from '@/lib/kosztorys/acceptance-protocol/types'

type ArgsT = {
  investment: InvestmentWithDetailsT
  today: string
}

export function protocolFormDefaults({ investment, today }: ArgsT): AcceptanceProtocolFormT {
  return {
    kind: 'final',
    place: prefilledPlace(investment),
    issueDate: today,
    acceptanceDate: today,
    readinessDate: '',
    clientName: prefilledClientName(investment),
    contractorName: CONTRACTOR_NAME,
    siteAddress: prefilledSiteAddress(investment),
    paymentDueDate: '',
  }
}

function prefilledClientName(investment: InvestmentWithDetailsT): string {
  return (
    formatBillingParty(investment.billing) || investment.contactPerson.trim() || investment.name
  )
}

function prefilledSiteAddress(investment: InvestmentWithDetailsT): string {
  return formatAddress({ ...investment, street: investment.address })
}

function prefilledPlace(investment: InvestmentWithDetailsT): string {
  return investment.city.trim() || 'Warszawa'
}

export function protocolPrefillKey(investment: InvestmentWithDetailsT): string {
  return [
    prefilledClientName(investment),
    prefilledSiteAddress(investment),
    prefilledPlace(investment),
  ].join('|')
}
