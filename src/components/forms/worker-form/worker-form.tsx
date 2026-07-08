'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { CashRegisterField } from '@/components/forms/form-fields'
import { workerFormSchema, type WorkerFormValuesT } from './worker-schema'
import { useWorkerFormStore } from '@/stores/form-stores'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import type { WorkerFormDataT } from './worker-schema'
import type { ReferenceItemT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import type { ActionResultT } from '@/lib/actions/utils'

type WorkerFormPropsT = {
  formId: string
  defaultValues: WorkerFormValuesT
  action: (data: WorkerFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  cashRegisters: ReferenceItemT[]
}

export function WorkerForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  cashRegisters,
}: WorkerFormPropsT) {
  const { form, reset } = useManagedForm<WorkerFormValuesT, WorkerFormDataT>({
    formId,
    store: useWorkerFormStore,
    schema: workerFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    toData: (value) => ({
      name: value.name,
      email: value.email,
      role: value.role,
      active: value.active,
      defaultCashRegister: value.defaultCashRegister
        ? Number(value.defaultCashRegister)
        : undefined,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="name">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Imię i nazwisko" placeholder="Jan Kowalski" showError />
          )}
        </form.AppField>

        <form.AppField name="email">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Email" type="email" placeholder="jan@example.com" showError />
          )}
        </form.AppField>

        <form.AppField name="role">
          {(field: AppFieldComponentsT) => (
            <field.Select label="Rola" showError>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        <CashRegisterField
          form={form}
          name="defaultCashRegister"
          label="Domyślna kasa"
          placeholder="Wybierz kasę"
          cashRegisters={cashRegisters}
        />

        <form.AppField name="active">
          {(field: AppFieldComponentsT) => <field.Checkbox label="Aktywny" />}
        </form.AppField>
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
