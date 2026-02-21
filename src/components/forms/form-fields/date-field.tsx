type DateFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function DateField({ form }: DateFieldPropsT) {
  return (
    <form.AppField name="date">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => <field.Input label="Data" type="date" showError />}
    </form.AppField>
  )
}
