import type { InvestmentBillingT, InvestmentDetailsT } from '@/types/reference-data'

export const NO_INVESTMENT_BILLING: InvestmentBillingT = {
  clientType: null,
  firstName: '',
  lastName: '',
  companyName: '',
  nip: '',
  representative: '',
  sameAsSite: true,
  street: '',
  postalCode: '',
  city: '',
  country: '',
}

export const NO_INVESTMENT_DETAILS: InvestmentDetailsT = {
  notes: '',
  aiNotes: '',
  postalCode: '',
  city: '',
  country: '',
  billing: NO_INVESTMENT_BILLING,
}
