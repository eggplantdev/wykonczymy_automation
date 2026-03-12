import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type DescriptionFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly placeholder?: string
}

export function DescriptionField({ form, placeholder = 'Opis transferu' }: DescriptionFieldPropsT) {
  return (
    <form.AppField name="description">
      {(field: AppFieldComponentsT) => (
        <field.Input label="Opis (opcjonalnie)" placeholder={placeholder} showError />
      )}
    </form.AppField>
  )
}
