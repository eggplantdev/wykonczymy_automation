'use client'

import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import {
  EquipmentItemFields,
  EquipmentNoteField,
  EquipmentPriceField,
  EquipmentStatusField,
} from './equipment-item-fields'
import { equipmentFormSchema, toEquipmentData } from './equipment-schema'
import type { EquipmentFormDataT, EquipmentFormValuesT } from './equipment-schema'
import { useEquipmentFormStore } from '@/stores/form-stores'
import type { ActionResultT } from '@/types/action'

type EquipmentFormPropsT = {
  formId: string
  defaultValues: EquipmentFormValuesT
  action: (data: EquipmentFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialogs — see `useManagedForm`. */
  persistDraft?: boolean
}

/** Edits one item's own attributes. Where it IS never appears here — that is „Przekaż". */
export function EquipmentForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
}: EquipmentFormPropsT) {
  const { form, reset } = useManagedForm<EquipmentFormValuesT, EquipmentFormDataT>({
    formId,
    useFormStore: useEquipmentFormStore,
    schema: equipmentFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: toEquipmentData,
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <EquipmentItemFields form={form} />
        <EquipmentPriceField form={form} />
        <EquipmentStatusField form={form} />
        <EquipmentNoteField form={form} />
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
