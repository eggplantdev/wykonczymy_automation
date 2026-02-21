'use client'

import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { RegisterTransferForm } from '@/components/forms/register-transfer-form/register-transfer-form'

type AddRegisterTransferDialogPropsT = {
  referenceData: ReferenceDataT
}

export function AddRegisterTransferDialog({ referenceData }: AddRegisterTransferDialogPropsT) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
        >
          <span className="hidden lg:block">Kasa</span>
          <ArrowLeftRight className="size-4" />
          <span className="hidden lg:block">Kasa</span>
        </Button>
      }
      title="Transfer między kasami"
      description="Przesuń środki między kasami."
    >
      {(onSuccess) => <RegisterTransferForm referenceData={referenceData} onSuccess={onSuccess} />}
    </FormDialog>
  )
}
