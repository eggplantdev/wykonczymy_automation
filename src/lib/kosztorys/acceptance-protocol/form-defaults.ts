import { CONTRACTOR_NAME } from '@/lib/kosztorys/acceptance-protocol/constants'
import { clientNameOf, siteAddressOf } from '@/lib/investments/prefill'
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
    clientName: clientNameOf(investment),
    contractorName: CONTRACTOR_NAME,
    siteAddress: siteAddressOf(investment),
    paymentDueDate: '',
  }
}

function prefilledPlace(investment: InvestmentWithDetailsT): string {
  return investment.city.trim() || 'Warszawa'
}

export function protocolPrefillKey(investment: InvestmentWithDetailsT): string {
  return [clientNameOf(investment), siteAddressOf(investment), prefilledPlace(investment)].join('|')
}
