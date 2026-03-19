import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type AmountFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  fieldClassName?: string
}

export function AmountField({ form, fieldClassName }: AmountFieldPropsT) {
  return (
    <form.AppField name="amount">
      {(field: AppFieldComponentsT) => (
        <field.Input
          label="Kwota (PLN)"
          placeholder="0.00"
          type="number"
          showError
          fieldClassName={fieldClassName}
        />
      )}
    </form.AppField>
  )
}
