import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'
import { toBillingFormValues } from './billing-form-values'
import type { InvestmentFormValuesT } from './investment-schema'

export const EMPTY_INVESTMENT_FORM_VALUES: InvestmentFormValuesT = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  contactPerson: '',
  billing: toBillingFormValues(NO_INVESTMENT_BILLING),
  initialInfo: { market: '' },
  notes: '',
  reviewRequested: false,
  // Nobody has agreed to do this work yet — „aktywna" would put it among the jobs actually running.
  status: 'quote',
  presetId: '',
}
