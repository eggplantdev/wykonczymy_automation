import {
  formatAddress,
  formatBillingAddress,
  formatBillingParty,
} from '@/lib/investments/format-address'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

export function clientNameOf(investment: InvestmentWithDetailsT): string {
  return (
    formatBillingParty(investment.billing) || investment.contactPerson.trim() || investment.name
  )
}

export function siteAddressOf(investment: InvestmentWithDetailsT): string {
  return formatAddress({ ...investment, street: investment.address })
}

export function clientAddressOf(investment: InvestmentWithDetailsT): string {
  return formatBillingAddress(investment.billing) || siteAddressOf(investment)
}
