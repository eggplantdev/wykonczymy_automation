'use client'

import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { InternalTransferForm } from '@/components/forms/internal-transfer-form/internal-transfer-form'

type InternalTransferDialogPropsT = {
  referenceData: ReferenceDataT
}

export function InternalTransferDialog({ referenceData }: InternalTransferDialogPropsT) {
  return (
    <FormDialog
      formId="internal-transfer"
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
      {(onSubmitSuccess, keepOpen) => (
        <InternalTransferForm
          referenceData={referenceData}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
