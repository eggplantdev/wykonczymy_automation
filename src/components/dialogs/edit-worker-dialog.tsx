'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { WorkerForm } from '@/components/forms/worker-form/worker-form'
import { updateWorkerAction } from '@/lib/actions/workers'
import type { WorkerRefT, ReferenceItemT } from '@/types/reference-data'

type EditWorkerDialogPropsT = {
  worker: WorkerRefT
  cashRegisters: ReferenceItemT[]
}

export function EditWorkerDialog({ worker, cashRegisters }: EditWorkerDialogPropsT) {
  const formId = `edit-worker-${worker.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <Button size="sm" variant="outline" aria-label="Edytuj pracownika">
          <Pencil className="size-4" />
          <span>Edytuj</span>
        </Button>
      }
      title="Edytuj pracownika"
      description={worker.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkerForm
          formId={formId}
          defaultValues={{
            name: worker.name,
            email: worker.email,
            role: worker.role,
            active: worker.active ?? true,
            defaultCashRegister: worker.defaultCashRegisterId
              ? String(worker.defaultCashRegisterId)
              : '',
          }}
          action={(data) => updateWorkerAction(worker.id, data)}
          successMessage="Pracownik zaktualizowany"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          cashRegisters={cashRegisters}
        />
      )}
    </FormDialog>
  )
}
