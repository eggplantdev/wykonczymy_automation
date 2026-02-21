type DescriptionFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly placeholder?: string
}

export function DescriptionField({ form, placeholder = 'Opis transferu' }: DescriptionFieldPropsT) {
  return (
    <form.AppField name="description">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Input label="Opis (opcjonalnie)" placeholder={placeholder} showError />
      )}
    </form.AppField>
  )
}
