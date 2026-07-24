import { SelectItem } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants/transfers'

type PaymentMethodFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function PaymentMethodField({ form }: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
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
