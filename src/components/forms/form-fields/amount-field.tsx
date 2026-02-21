type AmountFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function AmountField({ form }: AmountFieldPropsT) {
  return (
    <form.AppField name="amount">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Input label="Kwota (PLN)" placeholder="0.00" type="number" showError />
      )}
    </form.AppField>
  )
}
