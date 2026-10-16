import { CONTRACTOR_NAME } from '@/lib/kosztorys/acceptance-protocol/constants'
import { clientNameOf, siteAddressOf } from '@/lib/investments/prefill'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import type { AcceptanceProtocolFormT } from '@/lib/kosztorys/acceptance-protocol/types'

type ArgsT = {
  investment: InvestmentWithDetailsT
  today: string
}

function investmentPrefill(investment: InvestmentWithDetailsT) {
  return {
    place: investment.city.trim() || 'Warszawa',
    clientName: clientNameOf(investment),
    siteAddress: siteAddressOf(investment),
  }
}

export function protocolFormDefaults({ investment, today }: ArgsT): AcceptanceProtocolFormT {
  return {
    kind: 'final',
    issueDate: today,
    acceptanceDate: today,
    readinessDate: '',
    contractorName: CONTRACTOR_NAME,
    paymentDueDate: '',
    ...investmentPrefill(investment),
  }
}

export function protocolPrefillKey(investment: InvestmentWithDetailsT): string {
  return JSON.stringify(investmentPrefill(investment))
}
