import type {
  InvestmentBillingT,
  InvestmentDetailsT,
  InvestmentInitialInfoT,
} from '@/types/reference-data'

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

export const NO_INVESTMENT_INITIAL_INFO: InvestmentInitialInfoT = { market: null }

export const NO_INVESTMENT_DETAILS: InvestmentDetailsT = {
  notes: '',
  aiNotes: '',
  postalCode: '',
  city: '',
  country: '',
  billing: NO_INVESTMENT_BILLING,
  initialInfo: NO_INVESTMENT_INITIAL_INFO,
}
