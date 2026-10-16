import { DEFAULT_PLACE, DEFAULT_SUPERVISORS } from '@/lib/investments/contract/constants'
import type { ContractFormT } from '@/lib/investments/contract/types'
import { formatAddress } from '@/lib/investments/format-address'
import {
  clientAddressPartsOf,
  clientNameOf,
  siteAddressOf,
  siteAddressPartsOf,
} from '@/lib/investments/prefill'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type ArgsT = {
  investment: InvestmentWithDetailsT
  today: string
  plannedNet: number | undefined
}

const amountFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function contractFormDefaults({ investment, today, plannedNet }: ArgsT): ContractFormT {
  return {
    number: '',
    signDate: today,
    place: DEFAULT_PLACE,
    clientName: clientNameOf(investment),
    clientPesel: '',
    clientAddress: clientAddressPartsOf(investment),
    siteAddress: siteAddressPartsOf(investment),
    startWindow: '',
    duration: '',
    supervisors: DEFAULT_SUPERVISORS,
    plannedNet: plannedNet && plannedNet > 0 ? amountFormatter.format(plannedNet) : '',
    isCompany: isCompany(investment),
  }
}

function isCompany(investment: InvestmentWithDetailsT): boolean {
  return investment.billing.clientType === 'company'
}

export function contractPrefillKey(investment: InvestmentWithDetailsT): string {
  return [
    clientNameOf(investment),
    formatAddress(clientAddressPartsOf(investment)),
    siteAddressOf(investment),
    isCompany(investment),
  ].join('|')
}
