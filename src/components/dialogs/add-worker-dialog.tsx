'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { WorkerForm } from '@/components/forms/worker-form/worker-form'
import { createWorkerAction } from '@/lib/actions/workers'
import type { WorkerFormValuesT } from '@/components/forms/worker-form/worker-schema'
import type { ReferenceItemT } from '@/types/reference-data'

const EMPTY_DEFAULTS: WorkerFormValuesT = {
  name: '',
  email: '',
  role: 'EMPLOYEE',
  active: true,
  defaultCashRegister: '',
}

type AddWorkerDialogPropsT = {
  cashRegisters: ReferenceItemT[]
}

export function AddWorkerDialog({ cashRegisters }: AddWorkerDialogPropsT) {
  return (
    <FormDialog
      formId="add-worker"
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
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
        />
      )}
    </FormDialog>
  )
}
