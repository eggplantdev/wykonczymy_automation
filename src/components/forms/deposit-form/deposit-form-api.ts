import type { FormApiOfT } from '@/components/forms/hooks/form-api-of'

export type DepositFormValuesT = {
  description: string
  amount: string
  // The brutto kwota, typed only on a przelew — there `amount` is the faktura's netto beside it and
  // this one is the money that actually moved.
  amountGross: string
  date: string
  type: string
  paymentMethod: string
  vatPlane?: string
  sourceRegister: string
  investment?: string
}

export type DepositFormApiT = FormApiOfT<DepositFormValuesT>
