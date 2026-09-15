'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { CashRegisterForm } from '@/components/forms/cash-register-form/cash-register-form'
import { updateCashRegisterAction } from '@/lib/actions/cash-registers'
import type { CashRegisterRefT, WorkerRefT } from '@/types/reference-data'

type EditCashRegisterDialogPropsT = {
  register: CashRegisterRefT
  workers: WorkerRefT[]
}

export function EditCashRegisterDialog({ register, workers }: EditCashRegisterDialogPropsT) {
  const formId = `edit-cash-register-${register.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<EditButton label="Edytuj kasę" showLabel />}
      title="Edytuj kasę"
      description={register.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <CashRegisterForm
          formId={formId}
          defaultValues={{
            name: register.name,
            owner: register.ownerId ? String(register.ownerId) : '',
            type: register.type,
            active: register.active ?? true,
          }}
          action={(data) => updateCashRegisterAction(register.id, data)}
          successMessage="Kasa zaktualizowana"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
          workers={workers}
        />
      )}
    </FormDialog>
  )
}
