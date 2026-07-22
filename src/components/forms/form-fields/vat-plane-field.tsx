import { SelectItem } from '@/components/ui/select'
import { VAT_PLANES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'

// Radix Select forbids an empty-string SelectItem value, so the "unset" third state carries a
// non-empty sentinel; the deposit form maps it back to undefined (null vatPlane) on submit.
export const VAT_PLANE_NONE = 'none'

type VatPlaneFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function VatPlaneField({ form }: VatPlaneFieldPropsT) {
  return (
    <form.AppField name="vatPlane">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label="Wpłata netto czy brutto" placeholder="Wybierz" showError>
          <SelectItem value={VAT_PLANE_NONE}>— nie określono —</SelectItem>
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
