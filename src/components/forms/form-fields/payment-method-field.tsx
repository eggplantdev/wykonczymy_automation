import type { ReactNode } from 'react'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { SelectItem } from '@/components/ui/select'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transfers'

type PaymentMethodFieldPropsT = {
  readonly form: FormWithFieldT<'paymentMethod'>
  readonly listeners?: { onChange?: (arg: { value: string }) => void }
  readonly fieldClassName?: string
  readonly labels?: Record<PaymentMethodT, string>
  readonly label?: string
  readonly leadingOption?: ReactNode
}

export function PaymentMethodField({
  form,
  listeners,
  fieldClassName,
  labels = PAYMENT_METHOD_LABELS,
  label = 'Metoda płatności',
  leadingOption,
}: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod" listeners={listeners}>
      {(field) => (
        <field.Select label={label} showError fieldClassName={fieldClassName}>
          {leadingOption}
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {labels[m]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
