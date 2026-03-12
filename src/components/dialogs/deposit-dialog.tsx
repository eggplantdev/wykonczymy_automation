'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { DepositForm } from '@/components/forms/deposit-form/deposit-form'

type DepositDialogPropsT = {
  referenceData: ReferenceDataT
}

export function DepositDialog({ referenceData }: DepositDialogPropsT) {
  return (
    <FormDialog
      formId="deposit"
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
        >
          <Plus className="size-4" />
          <span className="hidden lg:block">Wpłata</span>
        </Button>
      }
      title="Nowa wpłata"
    >
      {(onSubmitSuccess, keepOpen) => (
        <DepositForm
          referenceData={referenceData}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
