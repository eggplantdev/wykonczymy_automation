'use client'

import { AddButton } from '@/components/ui/add-button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { CashRegisterForm } from '@/components/forms/cash-register-form/cash-register-form'
import { createCashRegisterAction } from '@/lib/actions/cash-registers'
import type { CashRegisterFormValuesT } from '@/components/forms/cash-register-form/cash-register-schema'
import { useReferenceData } from '@/hooks/use-reference-data'

const EMPTY_DEFAULTS: CashRegisterFormValuesT = {
  name: '',
  owner: '',
  type: 'AUXILIARY',
  active: true,
}

export function AddCashRegisterDialog() {
  const workers = useReferenceData()?.workers ?? []
  return (
    <FormDialog formId="add-cash-register" trigger={<AddButton>Dodaj</AddButton>} title="Nowa kasa">
      {(onSubmitSuccess, keepOpen) => (
        <CashRegisterForm
          formId="add-cash-register"
          defaultValues={EMPTY_DEFAULTS}
          action={createCashRegisterAction}
          successMessage="Kasa dodana"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          workers={workers}
        />
      )}
    </FormDialog>
  )
}
