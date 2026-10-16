import type { InvestmentBillingT } from '@/types/reference-data'

type AddressT = { street: string; postalCode: string; city: string; country: string }

const joinFilled = (parts: string[], separator: string) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(separator)

export function formatAddress({ street, postalCode, city, country }: AddressT): string {
  return joinFilled([street, joinFilled([postalCode, city], ' '), country], ', ')
}

export function formatBillingParty(billing: InvestmentBillingT): string {
  if (billing.clientType === 'person') {
    return joinFilled([billing.firstName, billing.lastName], ' ')
  }
  if (billing.clientType === 'company') {
    return joinFilled(
      [
        billing.companyName,
        billing.nip && `NIP ${billing.nip}`,
        billing.representative && `repr. ${billing.representative}`,
      ],
      ', ',
    )
  }
  return ''
}

export function formatBillingAddress(billing: InvestmentBillingT): string {
  return billing.sameAsSite ? '' : formatAddress(billing)
}
