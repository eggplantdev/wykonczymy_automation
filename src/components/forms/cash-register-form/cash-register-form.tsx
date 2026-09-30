'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { EntityComboboxField } from '@/components/forms/form-fields'
import { REGISTER_TYPE_LABELS } from '@/components/tables/cash-registers'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { CASH_REGISTER_OWNER_LOCKED_MESSAGE } from '@/lib/constants/cash-register-lock'
import { cashRegisterFormSchema, type CashRegisterFormValuesT } from './cash-register-schema'
import { useCashRegisterFormStore } from '@/stores/form-stores'
import type { CashRegisterFormDataT } from './cash-register-schema'
import type { CashRegisterTypeT, WorkerRefT } from '@/types/reference-data'
import type { ActionResultT } from '@/types/action'

const TYPES = Object.keys(REGISTER_TYPE_LABELS) as CashRegisterTypeT[]

type CashRegisterFormPropsT = {
  formId: string
  defaultValues: CashRegisterFormValuesT
  action: (data: CashRegisterFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialogs — see `useManagedForm`. */
  persistDraft?: boolean
  workers: WorkerRefT[]
  /** A kasa with live transactions keeps its owner — the server refuses the change too. */
  isOwnerLocked?: boolean
}

export function CashRegisterForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
  workers,
  isOwnerLocked,
}: CashRegisterFormPropsT) {
  // Mirrors what the collection allows a MANAGER to write: the type is forced to AUXILIARY and
  // `active` is admin/owner-only at field level, so showing either would be a control whose value
  // the server discards. The refusal itself lives server-side in `lib/actions/cash-registers.ts`.
  const canSetTypeAndActive = isAdminOrOwnerRole(useCurrentUser().role)

  const { form, reset } = useManagedForm<CashRegisterFormValuesT, CashRegisterFormDataT>({
    formId,
    useFormStore: useCashRegisterFormStore,
    schema: cashRegisterFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: (value) => ({
      name: value.name,
      owner: Number(value.owner),
      type: value.type,
      active: value.active,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="name">
          {(field) => <field.Input label="Nazwa" placeholder="Nazwa kasy" showError />}
        </form.AppField>

        <EntityComboboxField
          form={form}
          variant="owner"
          items={workers}
          lockedReason={isOwnerLocked ? CASH_REGISTER_OWNER_LOCKED_MESSAGE : undefined}
        />

        {canSetTypeAndActive && (
          <>
            <form.AppField name="type">
              {(field) => (
                <field.Select label="Typ" showError>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {REGISTER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

            <form.AppField name="active">
              {(field) => <field.Checkbox label="Aktywna" />}
            </form.AppField>
          </>
        )}
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
