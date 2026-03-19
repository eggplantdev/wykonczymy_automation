import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type DateFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  fieldClassName?: string
}

export function DateField({ form, fieldClassName }: DateFieldPropsT) {
  return (
    <form.AppField name="date">
      {(field: AppFieldComponentsT) => (
        <field.Input label="Data" type="date" showError fieldClassName={fieldClassName} />
      )}
    </form.AppField>
  )
}
