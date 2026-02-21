import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

const EXCLUDED_ROLES = ['ADMIN', 'OWNER'] as const

type WorkerFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly workers: readonly ReferenceItemT[]
  readonly filterByRole?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly listeners?: Record<string, any>
}

export function WorkerField({ form, workers, filterByRole = true, listeners }: WorkerFieldPropsT) {
  return (
    <form.AppField name="worker" listeners={listeners}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
          {workers
            .filter(
              (w) =>
                !filterByRole ||
                !EXCLUDED_ROLES.includes(w.type as (typeof EXCLUDED_ROLES)[number]),
            )
            .map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
              </SelectItem>
            ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
