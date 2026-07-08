'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import { FormClearButton } from '@/components/forms/form-components/form-clear-button'
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
  const { submit } = useFormSubmit(formId)

  const storedValues = useWorkerFormStore((s) => s.formData)
  const updateFormData = useWorkerFormStore((s) => s.updateFormData)
  const resetFormData = useWorkerFormStore((s) => s.resetFormData)

  const form = useAppForm({
    defaultValues: storedValues ?? defaultValues,
    validators: {
      onSubmit: workerFormSchema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as WorkerFormValuesT),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      const data: WorkerFormDataT = {
        name: value.name,
        email: value.email,
        role: value.role,
        active: value.active,
        defaultCashRegister: value.defaultCashRegister
          ? Number(value.defaultCashRegister)
          : undefined,
      }

      await submit(!!keepOpen, {
        form,
        action: () => action(data),
        successMessage,
        onSubmitSuccess,
        onReset: resetFormData,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return (
    <form.AppForm>
      <FormClearButton onReset={resetFormData} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
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
      </form>
    </form.AppForm>
  )
}
