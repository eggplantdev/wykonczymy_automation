'use client'

import { Plus } from 'lucide-react'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { WorkerForm } from '@/components/forms/worker-form/worker-form'
import { createWorkerAction } from '@/lib/actions/workers'
import type { WorkerFormValuesT } from '@/components/forms/worker-form/worker-schema'
import type { RoleT } from '@/lib/auth/roles'
import { useReferenceData } from '@/hooks/use-reference-data'

const EMPTY_DEFAULTS: WorkerFormValuesT = {
  name: '',
  email: '',
  phone: '',
  role: 'EMPLOYEE',
  active: true,
  canAddExpensesWithoutInvestment: false,
  defaultCashRegister: '',
  language: DEFAULT_LANGUAGE,
}

type AddWorkerDialogPropsT = {
  roles: RoleT[]
}

export function AddWorkerDialog({ roles }: AddWorkerDialogPropsT) {
  const cashRegisters = useReferenceData()?.cashRegisters ?? []
  return (
    <FormDialog
      formId="add-worker"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Dodaj
        </Button>
      }
      title="Nowy pracownik"
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkerForm
          formId="add-worker"
          defaultValues={EMPTY_DEFAULTS}
          action={createWorkerAction}
          successMessage="Pracownik dodany"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          cashRegisters={cashRegisters}
          roles={roles}
        />
      )}
    </FormDialog>
  )
}
