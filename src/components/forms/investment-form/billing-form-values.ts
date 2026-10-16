import type { InvestmentBillingT } from '@/types/reference-data'
import type { InvestmentBillingFormValuesT } from './investment-schema'

export function toBillingFormValues(billing: InvestmentBillingT): InvestmentBillingFormValuesT {
  return { ...billing, clientType: billing.clientType ?? '' }
}
