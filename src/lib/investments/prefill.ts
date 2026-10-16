import {
  formatAddress,
  formatBillingAddress,
  formatBillingParty,
  type AddressT,
} from '@/lib/investments/format-address'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

export function clientNameOf(investment: InvestmentWithDetailsT): string {
  return (
    formatBillingParty(investment.billing) || investment.contactPerson.trim() || investment.name
  )
}

export function siteAddressPartsOf(investment: InvestmentWithDetailsT): AddressT {
  const { address, postalCode, city, country } = investment
  return { street: address, postalCode, city, country }
}

export function siteAddressOf(investment: InvestmentWithDetailsT): string {
  return formatAddress(siteAddressPartsOf(investment))
}

export function clientAddressPartsOf(investment: InvestmentWithDetailsT): AddressT {
  const { billing } = investment
  if (!formatBillingAddress(billing)) return siteAddressPartsOf(investment)
  const { street, postalCode, city, country } = billing
  return { street, postalCode, city, country }
}
