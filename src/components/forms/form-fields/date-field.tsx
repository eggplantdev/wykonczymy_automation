import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type DateFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function DateField({ form }: DateFieldPropsT) {
  return (
    <form.AppField name="date">
      {(field: AppFieldComponentsT) => <field.Input label="Data" type="date" showError />}
    </form.AppField>
  )
}
