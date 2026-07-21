import { SelectItem } from '@/components/ui/select'
import { VAT_PLANES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type VatPlaneFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function VatPlaneField({ form }: VatPlaneFieldPropsT) {
  return (
    <form.AppField name="vatPlane">
      {(field: AppFieldComponentsT) => (
        <field.Select label="Wpłata netto czy brutto" placeholder="Wybierz" showError>
          {VAT_PLANES.map((p) => (
            <SelectItem key={p} value={p}>
              {VAT_PLANE_LABELS[p]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
