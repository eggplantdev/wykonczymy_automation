'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
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
      trigger={<EditButton label="Edytuj pracownika" showLabel className={`w-fit`} />}
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
          persistDraft={false}
          cashRegisters={cashRegisters}
        />
      )}
    </FormDialog>
  )
}
