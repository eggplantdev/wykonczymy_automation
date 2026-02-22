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
  const items = workers
    .filter(
      (w) => !filterByRole || !EXCLUDED_ROLES.includes(w.type as (typeof EXCLUDED_ROLES)[number]),
    )
    .map((w) => ({ value: String(w.id), label: w.name }))

  return (
    <form.AppField name="worker" listeners={listeners}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Combobox
          label="Pracownik"
          placeholder="Wybierz pracownika"
          searchPlaceholder="Szukaj pracownika..."
          emptyMessage="Nie znaleziono pracownika."
          items={items}
          showError
        />
      )}
    </form.AppField>
  )
}
