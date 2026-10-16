import { DEFAULT_PLACE, DEFAULT_SUPERVISORS } from '@/lib/investments/contract/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { ContractFormT } from '@/lib/investments/contract/types'
import { clientAddressPartsOf, clientNameOf, siteAddressPartsOf } from '@/lib/investments/prefill'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type ArgsT = {
  investment: InvestmentWithDetailsT
  today: string
  plannedNet: number | undefined
}

function investmentPrefill(investment: InvestmentWithDetailsT) {
  return {
    clientName: clientNameOf(investment),
    clientAddress: clientAddressPartsOf(investment),
    siteAddress: siteAddressPartsOf(investment),
    isCompany: investment.billing.clientType === 'company',
  }
}

export function contractFormDefaults({ investment, today, plannedNet }: ArgsT): ContractFormT {
  return {
    number: '',
    signDate: today,
    place: DEFAULT_PLACE,
    clientPesel: '',
    startWindow: '',
    duration: '',
    supervisors: DEFAULT_SUPERVISORS,
    plannedNet: plannedNet && plannedNet > 0 ? formatNet(plannedNet) : '',
    ...investmentPrefill(investment),
  }
}

export function contractPrefillKey(investment: InvestmentWithDetailsT): string {
  return JSON.stringify(investmentPrefill(investment))
}
