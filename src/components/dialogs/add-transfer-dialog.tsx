'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { TransferForm } from '@/components/forms/transfer-form/transfer-form'

type AddTransferDialogPropsT = {
  referenceData: ReferenceDataT
}

export function AddTransferDialog({ referenceData }: AddTransferDialogPropsT) {
  return (
    <FormDialog
      formId="transfer"
      trigger={
        <Button variant="default" size="sm" className="gap-2">
          <Plus className="size-4" />
          <span className="hidden lg:block">Transakcja</span>
        </Button>
      }
      title="Nowa transakcja"
    >
      {(onSuccess) => <TransferForm referenceData={referenceData} onSuccess={onSuccess} />}
    </FormDialog>
  )
}
