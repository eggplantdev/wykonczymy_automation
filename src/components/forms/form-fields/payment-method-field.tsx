import { SelectItem } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants/transfers'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type PaymentMethodFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function PaymentMethodField({ form }: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod">
      {(field: AppFieldComponentsT) => (
        <field.Select label="Metoda płatności" showError>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
