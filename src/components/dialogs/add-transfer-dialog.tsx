'use client'

import { Rocket } from 'lucide-react'
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
      className="max-w-[min(90vw,900px)]"
      trigger={
        <Button variant="default" size="sm" className="gap-2">
          <Rocket className="size-4" />
          <span className="hidden lg:block">Wydatek / zaliczka </span>
        </Button>
      }
      title="Nowy wydatek"
    >
      {(onSuccess, keepOpen) => (
        <TransferForm referenceData={referenceData} onSuccess={onSuccess} keepOpen={keepOpen} />
      )}
    </FormDialog>
  )
}
